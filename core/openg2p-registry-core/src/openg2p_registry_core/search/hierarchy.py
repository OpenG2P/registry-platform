"""Bulk-load the register tree and stitch it into the nested dict templates read.

One query per related register, using ``IN (...)``, instead of one query per row.
Child registers attach as a list under the snake_case mnemonic. The parent
register attaches as a single dict. The searched register is not attached back
onto its parent, so the tree does not cycle.
"""

from __future__ import annotations

import importlib
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import class_mapper

from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.models import G2PRegisterDefinition, RegisterPurposeEnum

IN_CHUNK = 1000


@dataclass
class LoadStep:
    definition: G2PRegisterDefinition
    attach_to_register_id: str
    direction: Literal["down", "up"]


def plan_register_loads(definitions: list, root) -> list[LoadStep]:
    """Register-level load order starting at ``root``.

    Descendants of the searched register come first, then each ancestor, then
    that ancestor's other child registers (not the searched register again).
    """
    by_id = {definition.register_id: definition for definition in definitions}
    children_of: dict[str, list] = defaultdict(list)
    for definition in definitions:
        parent_id = definition.master_register_id
        if parent_id and parent_id in by_id:
            children_of[parent_id].append(definition)

    steps: list[LoadStep] = []
    loaded = {root.register_id}

    def add_descendants(parent_def) -> None:
        queue = [parent_def]
        while queue:
            current = queue.pop(0)
            for child in children_of.get(current.register_id, []):
                if child.register_id in loaded:
                    continue
                loaded.add(child.register_id)
                steps.append(LoadStep(child, current.register_id, "down"))
                queue.append(child)

    add_descendants(root)

    current = root
    while current.master_register_id:
        parent = by_id.get(current.master_register_id)
        if parent is None or parent.register_id in loaded:
            break
        loaded.add(parent.register_id)
        steps.append(LoadStep(parent, current.register_id, "up"))
        for child in children_of.get(parent.register_id, []):
            if child.register_id == current.register_id or child.register_id in loaded:
                continue
            loaded.add(child.register_id)
            steps.append(LoadStep(child, parent.register_id, "down"))
            add_descendants(child)
        current = parent
    return steps


def record_to_dict(record) -> dict[str, Any]:
    if hasattr(record, "to_dict"):
        data = dict(record.to_dict())
    else:
        data = {
            column.name: getattr(record, column.name)
            for column in class_mapper(record.__class__).columns
        }
    for key, value in list(data.items()):
        if isinstance(value, datetime):
            data[key] = value.isoformat()
        elif isinstance(value, date):
            data[key] = value.isoformat()
    return data


def stitch(root_id: str, root_ids: list[str], dicts_by_register: dict[str, dict[str, dict]], steps: list[LoadStep]) -> list[dict]:
    """Attach loaded rows onto each other. Dicts are shared, so nesting is visible on the roots."""
    for step in steps:
        key = snake_case(step.definition.register_mnemonic)
        child_bucket = dicts_by_register.get(step.definition.register_id, {})
        parent_bucket = dicts_by_register.get(step.attach_to_register_id, {})
        if step.direction == "down":
            grouped: dict[str, list] = defaultdict(list)
            for record in child_bucket.values():
                link = record.get("link_internal_record_id")
                if link is not None:
                    grouped[link].append(record)
            for parent_id, parent in parent_bucket.items():
                parent[key] = grouped.get(parent_id, [])
            continue

        for child in parent_bucket.values():
            link = child.get("link_internal_record_id")
            parent = child_bucket.get(link) if link else None
            if parent is not None:
                child[key] = parent

    roots = dicts_by_register.get(root_id, {})
    return [roots[record_id] for record_id in root_ids if record_id in roots]


def snake_case(name: str) -> str:
    spaced = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", spaced).lower()


def resolve_model(definition: G2PRegisterDefinition):
    mnemonic = definition.register_mnemonic
    class_name = f"G2PRegister{mnemonic}"
    purpose = definition.register_purpose
    purpose_value = purpose.value if isinstance(purpose, RegisterPurposeEnum) else purpose
    if purpose_value == RegisterPurposeEnum.CORE_TABLE.value:
        module_name = "openg2p_registry_core.models"
    else:
        module_name = "openg2p_registry_extensions.register_domain.models"
    try:
        module = importlib.import_module(module_name)
        model = getattr(module, class_name)
    except (AttributeError, ModuleNotFoundError) as error:
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.REGISTER_DATA_NOT_FOUND.value[1],
            message=f"Register implementation not found for {mnemonic}",
        ) from error
    return model


async def load_related(session, root_definition, root_rows: list, definitions: list) -> list[dict]:
    """Load every related register in bulk and return one nested dict per root row."""
    steps = plan_register_loads(definitions, root_definition)
    models: dict[str, Any] = {root_definition.register_id: resolve_model(root_definition)}
    rows_by_register: dict[str, list] = {root_definition.register_id: list(root_rows)}
    dicts_by_register: dict[str, dict[str, dict]] = {
        root_definition.register_id: {
            row.internal_record_id: record_to_dict(row) for row in root_rows
        }
    }

    for step in steps:
        model = models.get(step.definition.register_id)
        if model is None:
            model = resolve_model(step.definition)
            models[step.definition.register_id] = model

        if step.direction == "up":
            source_rows = rows_by_register.get(step.attach_to_register_id, [])
            wanted = {
                getattr(row, "link_internal_record_id", None)
                for row in source_rows
            }
            wanted.discard(None)
            loaded = await _select_in(
                session, model, model.internal_record_id, wanted
            )
        else:
            source_rows = rows_by_register.get(step.attach_to_register_id, [])
            wanted = {row.internal_record_id for row in source_rows}
            link_column = getattr(model, "link_internal_record_id", None)
            if link_column is None:
                loaded = []
            else:
                loaded = await _select_in(session, model, link_column, wanted)

        rows_by_register[step.definition.register_id] = loaded
        dicts_by_register[step.definition.register_id] = {
            row.internal_record_id: record_to_dict(row) for row in loaded
        }

    root_ids = [row.internal_record_id for row in root_rows]
    return stitch(root_definition.register_id, root_ids, dicts_by_register, steps)


async def _select_in(session, model, column, ids: set) -> list:
    if not ids:
        return []
    conditions = _active_conditions(model)
    found = []
    id_list = list(ids)
    for start in range(0, len(id_list), IN_CHUNK):
        chunk = id_list[start : start + IN_CHUNK]
        query = select(model).where(column.in_(chunk), *conditions)
        found.extend((await session.execute(query)).scalars().all())
    return found


def _active_conditions(model) -> list:
    status = getattr(model, "record_status", None)
    if status is None:
        return []
    return [status == "ACTIVE"]

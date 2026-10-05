import importlib
import json
from dataclasses import dataclass

from sqlalchemy import select

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import (
    G2PRegisterDefinition,
    G2PRegisterSchema,
    RegisterPurposeEnum,
)
from ..repositories import RegisterRecordRepository


@dataclass
class RegisterExportHierarchy:
    ancestors: list[G2PRegisterDefinition]
    main: G2PRegisterDefinition
    descendants: list[G2PRegisterDefinition]
    children_by_parent: dict[str, list[G2PRegisterDefinition]]

    @property
    def ordered_registers(self) -> list[G2PRegisterDefinition]:
        return [*self.ancestors, self.main, *self.descendants]


def get_register_implementation_class(register_definition: G2PRegisterDefinition):
    if register_definition.register_purpose == RegisterPurposeEnum.CORE_TABLE.value:
        module = importlib.import_module("openg2p_registry_core.models")
    else:
        module = importlib.import_module(
            "openg2p_registry_extensions.register_domain.models"
        )
    class_name = f"G2PRegister{register_definition.register_mnemonic}"
    try:
        return getattr(module, class_name)
    except AttributeError as exc:
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.REGISTER_DATA_NOT_FOUND.value[1],
            message=(
                f"Register implementation {class_name} was not found for "
                f"{register_definition.register_id}"
            ),
        ) from exc


def resolve_register_export_hierarchy(
    session, register_id: str
) -> RegisterExportHierarchy:
    main = session.get(G2PRegisterDefinition, register_id)
    if main is None:
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[1],
            message=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[0],
        )

    ancestors_nearest_first: list[G2PRegisterDefinition] = []
    visited = {main.register_id}
    parent_id = main.master_register_id
    while parent_id:
        if parent_id in visited:
            raise ValueError("Cycle detected in register parent hierarchy")
        parent = session.get(G2PRegisterDefinition, parent_id)
        if parent is None:
            raise ValueError(f"Parent register {parent_id} does not exist")
        visited.add(parent.register_id)
        ancestors_nearest_first.append(parent)
        parent_id = parent.master_register_id

    descendants: list[G2PRegisterDefinition] = []
    children_by_parent: dict[str, list[G2PRegisterDefinition]] = {}
    pending_parent_ids = [main.register_id]
    while pending_parent_ids:
        current_parent_id = pending_parent_ids.pop(0)
        children = (
            session.execute(
                select(G2PRegisterDefinition)
                .where(
                    G2PRegisterDefinition.master_register_id == current_parent_id
                )
                .order_by(G2PRegisterDefinition.register_id)
            )
            .scalars()
            .all()
        )
        children_by_parent[current_parent_id] = children
        for child in children:
            if child.register_id in visited:
                raise ValueError("Cycle detected in register child hierarchy")
            visited.add(child.register_id)
            descendants.append(child)
            pending_parent_ids.append(child.register_id)

    return RegisterExportHierarchy(
        ancestors=list(reversed(ancestors_nearest_first)),
        main=main,
        descendants=descendants,
        children_by_parent=children_by_parent,
    )


def build_register_policy_condition(
    register_id: str,
    implementation_class,
    data_policies: list[dict] | None,
):
    if not data_policies:
        return None
    from iam_core.helpers.data_policy_helper import DataPolicyHelper

    merged_expression = DataPolicyHelper.resolve_register_record_policy(
        data_policies, register_id
    )
    if not merged_expression:
        return None
    return RegisterRecordRepository(
        implementation_class
    ).build_policy_condition(merged_expression)


def build_main_export_conditions(
    session,
    register_definition: G2PRegisterDefinition,
    implementation_class,
    *,
    search_text: str | None,
    filter_by: dict | str | None,
    data_policies: list[dict] | None,
) -> list:
    from ..services.filter_builder import FilterBuilder

    conditions = []
    if search_text and search_text.strip():
        conditions.append(
            implementation_class.search_text.ilike(f"%{search_text.strip()}%")
        )
    if (
        hasattr(implementation_class, "record_status")
        and not has_explicit_record_status_filter(filter_by)
    ):
        conditions.append(implementation_class.record_status == "ACTIVE")

    register_schema = session.execute(
        select(G2PRegisterSchema).where(
            G2PRegisterSchema.register_id == register_definition.register_id
        )
    ).scalar_one_or_none()
    filter_schema = (
        register_schema.filter_schema
        if register_schema and register_schema.filter_schema
        else []
    )
    conditions.extend(
        FilterBuilder(filter_schema).build_conditions(
            filter_by, implementation_class
        )
    )
    policy_condition = build_register_policy_condition(
        register_definition.register_id,
        implementation_class,
        data_policies,
    )
    if policy_condition is not None:
        conditions.append(policy_condition)
    return conditions


def build_related_export_conditions(
    register_definition: G2PRegisterDefinition,
    implementation_class,
    data_policies: list[dict] | None,
) -> list:
    conditions = []
    if hasattr(implementation_class, "record_status"):
        conditions.append(implementation_class.record_status == "ACTIVE")
    policy_condition = build_register_policy_condition(
        register_definition.register_id,
        implementation_class,
        data_policies,
    )
    if policy_condition is not None:
        conditions.append(policy_condition)
    return conditions


def apply_register_export_sort(query, implementation_class, sort_by: str | None):
    sort_column = None
    descending = False
    if sort_by:
        column_name = sort_by.lstrip("-")
        descending = sort_by.startswith("-")
        sort_column = getattr(implementation_class, column_name, None)
    if sort_column is None:
        sort_column = implementation_class.last_approved_at
        descending = True

    query = query.order_by(
        sort_column.desc() if descending else sort_column.asc()
    )
    if sort_column is not implementation_class.internal_record_id:
        query = query.order_by(implementation_class.internal_record_id.asc())
    return query


def has_explicit_record_status_filter(filter_by: dict | str | None) -> bool:
    if not filter_by:
        return False
    if isinstance(filter_by, str):
        try:
            filter_by = json.loads(filter_by)
        except json.JSONDecodeError:
            return False
    return isinstance(filter_by, dict) and "record_status" in filter_by

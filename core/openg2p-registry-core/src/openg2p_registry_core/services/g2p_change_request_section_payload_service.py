from __future__ import annotations

import importlib
from collections.abc import Iterable
from typing import Any, NoReturn

from openg2p_fastapi_common.service import BaseService
from sqlalchemy import inspect
from sqlalchemy.exc import NoInspectionAvailable
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import G2PRegisterDefinition, G2PRegisterSection
from ..schemas.change_request import ChangePayload

_DOMAIN_MODELS_MODULE = "openg2p_registry_extensions.register_domain.models"
_REGISTER_CLASS_PREFIX = "G2PRegister"
_ALWAYS_ALLOWED_CONTROL_FIELDS = frozenset(
    {"edit_action", "internal_record_id", "link_internal_record_id"}
)
_TABLE_WIDGETS = frozenset({"table", "dialog-table"})
# `file` is the current upload widget. `docs`/`documents` remain for older schemas.
_DOCUMENT_WIDGETS = frozenset({"file", "docs", "documents"})


class G2PChangeRequestSectionPayloadService(BaseService):
    """Validate change payload fields against a section's persisted UI bindings."""

    async def validate(
        self,
        change_payloads: list[ChangePayload],
        section: G2PRegisterSection,
        section_register_definition: G2PRegisterDefinition,
        session: AsyncSession,
    ) -> list[ChangePayload]:
        schema = section.section_ui_schema
        if not isinstance(schema, dict):
            self._raise_configuration_error(
                section.section_id, "section_ui_schema must be an object"
            )
        if schema.get("section-editable") is False:
            self._raise_configuration_error(
                section.section_id, "section is not editable"
            )
        if not isinstance(schema.get("panels"), list) or not schema["panels"]:
            self._raise_configuration_error(
                section.section_id, "section_ui_schema has no panels"
            )

        orm_fields = await self._resolve_orm_fields(
            section,
            section_register_definition,
            session,
        )
        allowed_fields = self.resolve_allowed_fields(
            schema,
            section.section_register_id,
            orm_fields,
        )
        has_document_widget = self.has_editable_document_widget(schema)
        if not allowed_fields:
            if not self.is_document_only_schema(schema):
                self._raise_configuration_error(
                    section.section_id,
                    "section_ui_schema has no editable persisted fields",
                )

        allowed_payload_fields = set(allowed_fields)
        allowed_payload_fields.update(_ALWAYS_ALLOWED_CONTROL_FIELDS)
        if has_document_widget:
            allowed_payload_fields.add("documents")

        sanitized_payloads = self._strip_non_orm_fields(
            change_payloads,
            orm_fields,
        )
        violations: list[tuple[int, list[str]]] = []
        for row_index, change_payload in enumerate(sanitized_payloads):
            unknown_fields = sorted(
                set(change_payload.model_dump(exclude_unset=True))
                - allowed_payload_fields
            )
            if unknown_fields:
                violations.append((row_index, unknown_fields))

        if violations:
            details = "; ".join(
                f"row {row_index}: {', '.join(fields)}"
                for row_index, fields in violations
            )
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                message=(
                    f"Change payload contains fields not allowed by section "
                    f"'{section.section_id}': {details}"
                ),
            )

        await self._validate_section_documents(
            sanitized_payloads,
            section,
            session,
            require_document_intent=not allowed_fields,
        )
        meaningful_payloads: list[ChangePayload] = []
        for row_index, change_payload in enumerate(sanitized_payloads):
            action = change_payload.edit_action
            if action == "NO_CHANGE":
                continue

            fields_set = getattr(change_payload, "model_fields_set", set())
            has_domain_change = bool(fields_set & allowed_fields)
            has_document_change = (
                "documents" in fields_set
                and change_payload.documents is not None
            )
            if (
                action != "DELETE"
                and not has_domain_change
                and not has_document_change
            ):
                self._raise_request_validation_error(
                    f"Change payload row {row_index} contains no editable "
                    "fields or document changes after removing non-ORM fields"
                )
            meaningful_payloads.append(change_payload)

        if not meaningful_payloads:
            self._raise_request_validation_error(
                "Change payload contains no meaningful changes"
            )
        return meaningful_payloads

    def _strip_non_orm_fields(
        self,
        change_payloads: list[ChangePayload],
        orm_fields: set[str],
    ) -> list[ChangePayload]:
        preserved_fields = set(orm_fields)
        preserved_fields.update(_ALWAYS_ALLOWED_CONTROL_FIELDS)
        preserved_fields.add("documents")

        return [
            ChangePayload.model_validate(
                {
                    key: value
                    for key, value in change_payload.model_dump(
                        exclude_unset=True
                    ).items()
                    if key in preserved_fields
                }
            )
            for change_payload in change_payloads
        ]

    def resolve_allowed_fields(
        self,
        schema: dict[str, Any],
        section_register_id: str,
        orm_fields: set[str],
    ) -> set[str]:
        allowed_fields: set[str] = set()
        self._walk_schema_nodes(
            schema.get("panels", []),
            section_register_id,
            orm_fields,
            allowed_fields,
        )
        return allowed_fields

    def has_editable_document_widget(self, schema: dict[str, Any]) -> bool:
        return self._contains_editable_document_widget(schema.get("panels", []))

    async def _validate_section_documents(
        self,
        change_payloads: list[ChangePayload],
        section: G2PRegisterSection,
        session: AsyncSession,
        *,
        require_document_intent: bool,
    ) -> None:
        document_ids: list[str] = []

        for row_index, change_payload in enumerate(change_payloads):
            fields_set = getattr(change_payload, "model_fields_set", set())
            action = change_payload.edit_action
            if (
                require_document_intent
                and action not in {"DELETE", "NO_CHANGE"}
                and (
                    "documents" not in fields_set
                    or change_payload.documents is None
                )
            ):
                self._raise_request_validation_error(
                    f"Document-only section '{section.section_id}' row "
                    f"{row_index} requires an explicit row-level documents list"
                )
            if "documents" not in fields_set:
                continue

            documents = change_payload.documents
            if documents is None:
                continue

            if action in {"DELETE", "NO_CHANGE"}:
                self._raise_request_validation_error(
                    f"row {row_index}: documents are not allowed for {action}"
                )

            ids = [document.document_id for document in documents]
            duplicate_ids = sorted(
                document_id
                for document_id in set(ids)
                if ids.count(document_id) > 1
            )
            if duplicate_ids:
                self._raise_request_validation_error(
                    f"row {row_index}: duplicate document IDs: "
                    f"{', '.join(duplicate_ids)}"
                )
            if getattr(section, "documents_required", False) and not documents:
                self._raise_request_validation_error(
                    f"row {row_index}: section '{section.section_id}' requires "
                    "at least one document"
                )

            document_ids.extend(ids)

        if document_ids:
            from .g2p_document_service import G2PDocumentService

            await G2PDocumentService.get_component().validate_documents_exist(
                session,
                document_ids,
            )

    def is_document_only_schema(self, schema: dict[str, Any]) -> bool:
        panels = schema.get("panels", [])
        return self._contains_editable_document_widget(
            panels
        ) and not self._contains_editable_data_binding(panels)

    def _contains_editable_document_widget(self, nodes: Any) -> bool:
        if isinstance(nodes, list):
            return any(self._contains_editable_document_widget(node) for node in nodes)
        if not isinstance(nodes, dict):
            return False
        if nodes.get("widget-readonly") is True:
            return False
        if nodes.get("widget") in _DOCUMENT_WIDGETS:
            return True
        return any(
            self._contains_editable_document_widget(nodes[child_key])
            for child_key in ("panels", "widgets", "widget-item")
            if child_key in nodes
        )

    def _contains_editable_data_binding(self, nodes: Any) -> bool:
        if isinstance(nodes, list):
            return any(self._contains_editable_data_binding(node) for node in nodes)
        if not isinstance(nodes, dict):
            return False
        if nodes.get("widget-readonly") is True:
            return False

        is_widget = any(
            key in nodes
            for key in (
                "widget",
                "widget-type",
                "widget-data-path",
                "widget-data-columns",
            )
        )
        if (
            is_widget
            and nodes.get("widget") not in _DOCUMENT_WIDGETS
            and ("widget-data-path" in nodes or "widget-data-columns" in nodes)
        ):
            return True

        return any(
            self._contains_editable_data_binding(nodes[child_key])
            for child_key in ("panels", "widgets", "widget-item")
            if child_key in nodes
        )

    def _walk_schema_nodes(
        self,
        nodes: Any,
        section_register_id: str,
        orm_fields: set[str],
        allowed_fields: set[str],
    ) -> None:
        if isinstance(nodes, list):
            for node in nodes:
                self._walk_schema_nodes(
                    node,
                    section_register_id,
                    orm_fields,
                    allowed_fields,
                )
            return
        if not isinstance(nodes, dict):
            return

        is_widget = any(
            key in nodes
            for key in (
                "widget",
                "widget-type",
                "widget-data-path",
                "widget-data-columns",
            )
        )
        if is_widget:
            self._collect_widget_fields(
                nodes,
                section_register_id,
                orm_fields,
                allowed_fields,
            )
            return

        for child_key in ("panels", "widgets", "widget-item"):
            if child_key in nodes:
                self._walk_schema_nodes(
                    nodes[child_key],
                    section_register_id,
                    orm_fields,
                    allowed_fields,
                )

    def _collect_widget_fields(
        self,
        widget: dict[str, Any],
        section_register_id: str,
        orm_fields: set[str],
        allowed_fields: set[str],
    ) -> None:
        if widget.get("widget-readonly") is True:
            return

        widget_name = widget.get("widget")
        if widget_name in _DOCUMENT_WIDGETS:
            for child_key in ("widgets", "widget-item"):
                if child_key in widget:
                    self._walk_schema_nodes(
                        widget[child_key],
                        section_register_id,
                        orm_fields,
                        allowed_fields,
                    )
            return

        widget_type = widget.get("widget-type")
        columns = widget.get("widget-data-columns")
        is_table_widget = (
            widget_name in _TABLE_WIDGETS
            or widget_type == "table"
            or isinstance(columns, list)
        )

        if is_table_widget:
            if isinstance(columns, list):
                for column in columns:
                    if (
                        not isinstance(column, dict)
                        or column.get("widget-readonly") is True
                    ):
                        continue
                    column_key = column.get("column-key")
                    if isinstance(column_key, str) and column_key in orm_fields:
                        allowed_fields.add(column_key)
        else:
            for path in self._iter_path_values(widget.get("widget-data-path")):
                field = self._field_from_path(path, section_register_id, orm_fields)
                if field:
                    allowed_fields.add(field)

        for child_key in ("widgets", "widget-item"):
            if child_key in widget:
                self._walk_schema_nodes(
                    widget[child_key],
                    section_register_id,
                    orm_fields,
                    allowed_fields,
                )

    def _iter_path_values(self, value: Any) -> Iterable[str]:
        if isinstance(value, str):
            if value.strip():
                yield value.strip()
            return
        if isinstance(value, dict):
            for nested_value in value.values():
                yield from self._iter_path_values(nested_value)
            return
        if isinstance(value, list):
            for nested_value in value:
                yield from self._iter_path_values(nested_value)

    def _field_from_path(
        self,
        path: str,
        section_register_id: str,
        orm_fields: set[str],
    ) -> str | None:
        path_parts = [part for part in path.split(".") if part]
        if not path_parts:
            return None
        if path_parts[0] == section_register_id:
            if len(path_parts) < 2:
                return None
            field = path_parts[1]
        else:
            field = path_parts[0]
        return field if field in orm_fields else None

    async def _resolve_orm_fields(
        self,
        section: G2PRegisterSection,
        supplied_definition: G2PRegisterDefinition,
        session: AsyncSession,
    ) -> set[str]:
        live_definition = await session.get(
            G2PRegisterDefinition,
            section.section_register_id,
        )
        if live_definition is None:
            self._raise_configuration_error(
                section.section_id,
                f"section register '{section.section_register_id}' was not found",
            )
        if (
            live_definition.register_id != supplied_definition.register_id
            or live_definition.register_mnemonic
            != supplied_definition.register_mnemonic
        ):
            self._raise_configuration_error(
                section.section_id,
                "section register definition is inconsistent",
            )

        try:
            model_module = importlib.import_module(_DOMAIN_MODELS_MODULE)
            model_class = getattr(
                model_module,
                f"{_REGISTER_CLASS_PREFIX}{live_definition.register_mnemonic}",
            )
            return set(inspect(model_class).columns.keys())
        except (ImportError, AttributeError, NoInspectionAvailable) as error:
            self._raise_configuration_error(
                section.section_id,
                (
                    "could not resolve the ORM model for section register "
                    f"'{live_definition.register_mnemonic}': {error}"
                ),
            )

    def _raise_configuration_error(self, section_id: str, detail: str) -> NoReturn:
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
            message=f"Invalid section payload configuration for section '{section_id}': {detail}",
        )

    def _raise_request_validation_error(self, message: str) -> NoReturn:
        raise G2PRegistryException(
            code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
            message=message,
        )

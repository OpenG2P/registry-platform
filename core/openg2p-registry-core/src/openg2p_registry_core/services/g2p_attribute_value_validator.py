import logging
from typing import Any, Iterable, Optional

from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings
from ..errors import G2PRegistryErrorCodes, G2PRegistryException

_config = Settings.get_config(strict=False)
_logger = logging.getLogger("g2p-attribute-value-validator")


class G2PAttributeValueValidator(BaseService):
    """Validate change-request codes against Master Data code lists."""

    def __init__(self):
        super().__init__()

    @property
    def enabled(self) -> bool:
        return bool(getattr(_config, "validate_attribute_values", False))

    def invalidate(self) -> None:
        from ..helpers.master_data import MasterDataClient

        client = MasterDataClient.get_component()
        if client is not None:
            client.invalidate()

    async def _load(self) -> dict[str, set[str]]:
        from ..helpers.master_data import MasterDataClient

        client = MasterDataClient.get_component()
        if client is None:
            client = MasterDataClient()
        return await client.get_attribute_codes()

    @staticmethod
    def _path_fields(value: Any) -> Iterable[str]:
        if isinstance(value, str):
            field = value.rsplit(".", 1)[-1].strip()
            if field:
                yield field
        elif isinstance(value, dict):
            for nested in value.values():
                yield from G2PAttributeValueValidator._path_fields(nested)
        elif isinstance(value, list):
            for nested in value:
                yield from G2PAttributeValueValidator._path_fields(nested)

    @classmethod
    def field_map_from_ui_schema(cls, schema: Any) -> dict[str, str]:
        """Map persisted fields to Master Data attributes declared by widgets."""
        field_map: dict[str, str] = {}

        def walk(node: Any) -> None:
            if isinstance(node, list):
                for item in node:
                    walk(item)
                return
            if not isinstance(node, dict):
                return

            source = node.get("widget-data-source")
            params = source.get("params") if isinstance(source, dict) else None
            attribute_id = params.get("attribute_id") if isinstance(params, dict) else None
            if isinstance(attribute_id, str) and attribute_id:
                column_key = node.get("column-key")
                if isinstance(column_key, str) and column_key:
                    field_map[column_key] = attribute_id
                else:
                    for field in cls._path_fields(node.get("widget-data-path")):
                        field_map[field] = attribute_id

            for value in node.values():
                walk(value)

        walk(schema)
        return field_map

    @staticmethod
    def _values_of(value: Any) -> Iterable[Any]:
        if isinstance(value, (list, tuple, set)):
            return value
        return [value]

    @staticmethod
    def records_for_validation(records: list[dict]) -> list[dict]:
        return [
            record
            for record in records
            if not isinstance(record, dict) or record.get("edit_action") != "DELETE"
        ]

    async def validate_records(
        self,
        records: list[dict],
        *,
        field_map: Optional[dict[str, str]] = None,
    ) -> None:
        if not self.enabled or not records:
            return

        codes = await self._load()
        if not codes:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                message=(
                    "Attribute validation is enabled, but Master Data has no "
                    "attribute values configured"
                ),
            )

        problems: list[str] = []
        for index, record in enumerate(records):
            if not isinstance(record, dict):
                continue
            for field, raw in record.items():
                attribute_id = field_map.get(field) if field_map is not None else field.upper()
                if not attribute_id:
                    continue
                permitted = codes.get(attribute_id)
                if not permitted:
                    continue
                for value in self._values_of(raw):
                    if value is None or value == "" or not isinstance(value, str):
                        continue
                    if value not in permitted:
                        problems.append(
                            f"record {index}: {field}={value!r} is not a value of "
                            f"{attribute_id} (permitted: {', '.join(sorted(permitted))})"
                        )

        if problems:
            _logger.info(
                "rejected %d coded value(s) against Master Data", len(problems)
            )
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REQUEST_VALIDATION_ERROR.value[1],
                message="; ".join(problems),
            )

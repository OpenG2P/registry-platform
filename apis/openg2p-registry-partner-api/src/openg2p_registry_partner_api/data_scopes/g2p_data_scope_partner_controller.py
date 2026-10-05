"""The registry's data scope catalogue, for partners choosing what to ask consent for.

Not tied to DCI: a scope is a named group of this registry's own fields, with
ID ``<controller>.<name>``. Consents and Consent Manager policies name scope
IDs; this catalogue says which fields each ID means, version by version.

* ``GET /partner/data_scopes`` — public read: the catalogue holds field
  references only, never values.
* ``POST /partner/data_scopes`` — the same, as a signed partner message (the
  envelope and signature check of the other partner calls), for partners that
  only make signed calls.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import Request
from openg2p_fastapi_common.controller import BaseController
from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.services import G2PDataScopeService
from pydantic import BaseModel, Field

from ..audit_context import set_audit_actor, set_audit_outcome
from ..config import Settings
from ..search.dci.helpers import DciKeymanagerHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class DataScopeVersionData(BaseModel):
    version: int
    effective_from: Optional[str] = None
    fields: list[str] = Field(default_factory=list)
    resolved_fields: list[str] = Field(default_factory=list)
    renamed_fields: Optional[dict[str, str]] = None


class DataScopeData(BaseModel):
    scope_id: str
    name: str
    data_controller: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    status: str
    source: Optional[str] = None
    current_version: int
    retired_at: Optional[str] = None
    versions: list[DataScopeVersionData] = Field(default_factory=list)


class DataScopeListResponse(BaseModel):
    data_controller: Optional[str] = None
    data_scopes: list[DataScopeData] = Field(default_factory=list)
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class DataScopeRequestHeader(BaseModel):
    sender_id: str
    message_id: str
    message_ts: datetime
    receiver_id: Optional[str] = None


class DataScopeRequestEnvelope(BaseModel):
    signature: Optional[str] = None
    header: DataScopeRequestHeader
    message: dict[str, Any] = Field(default_factory=dict)


class G2PDataScopePartnerController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/partner/data_scopes"]
        self.router.prefix = "/partner/data_scopes"
        self.data_scopes = G2PDataScopeService.get_component() or G2PDataScopeService()
        self.keymanager_helper = DciKeymanagerHelper()
        self.router.add_api_route(
            "", self.get_data_scopes, responses={200: {"model": DataScopeListResponse}}, methods=["GET"]
        )
        self.router.add_api_route(
            "", self.post_data_scopes, responses={200: {"model": DataScopeListResponse}}, methods=["POST"]
        )

    async def _catalogue(self) -> DataScopeListResponse:
        controller = self.data_scopes.controller_id()
        return DataScopeListResponse(
            data_controller=controller or None, data_scopes=await self.data_scopes.list_scopes()
        )

    async def get_data_scopes(self) -> DataScopeListResponse:
        try:
            return await self._catalogue()
        except Exception as error:
            _logger.exception("Data scope catalogue request failed")
            return DataScopeListResponse(
                error_code=G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1], error_message=str(error)
            )

    async def post_data_scopes(self, envelope: DataScopeRequestEnvelope, request: Request) -> DataScopeListResponse:
        try:
            raw_body: dict[str, Any] = await request.json()
            if _config.signature_validation_enabled:
                if not envelope.signature:
                    raise G2PRegistryException(
                        code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1], message="signature is required"
                    )
                await self.keymanager_helper.validate_signature(
                    envelope.signature, raw_body.get("header") or {}, raw_body.get("message") or {}
                )
            else:
                _logger.warning("signature_validation_enabled=false — accepting an unsigned partner message")
            set_audit_actor(request, envelope.header.sender_id, verified=_config.signature_validation_enabled)
            return await self._catalogue()
        except G2PRegistryException as error:
            set_audit_outcome(request, "failure", reason=error.code)
            return DataScopeListResponse(error_code=error.code, error_message=error.message)
        except Exception as error:
            _logger.exception("Data scope catalogue request failed")
            set_audit_outcome(request, "failure", reason=G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1])
            return DataScopeListResponse(
                error_code=G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1], error_message=str(error)
            )

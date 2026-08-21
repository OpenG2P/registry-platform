from datetime import datetime
from typing import Any, Optional

from openg2p_fastapi_common.schemas import (
    G2PRequest,
    G2PResponseHeader,
    G2PResponseStatus,
)
from openg2p_fastapi_common.service import BaseService


class RequestResponseHelper(BaseService):
    """Builds the standard G2P response envelope."""

    @staticmethod
    def _header(
        request: Optional[G2PRequest],
        status: G2PResponseStatus,
        code: str = "",
        message: str = "",
    ) -> G2PResponseHeader:
        return G2PResponseHeader(
            request_id=request.request_header.request_id if request else "",
            response_status=status,
            response_error_code=code,
            response_error_message=message,
            response_timestamp=datetime.now(),
        )

    def success(self, response_cls: Any, body_cls: Any, payload: Any, request=None) -> Any:
        return response_cls(
            response_header=self._header(request, G2PResponseStatus.SUCCESS),
            response_body=body_cls(response_payload=payload),
        )

    def error(
        self, response_cls: Any, body_cls: Any, code: str, message: str, request=None
    ) -> Any:
        return response_cls(
            response_header=self._header(
                # G2PResponseStatus has exactly two members, SUCCESS and ERROR.
                # FAILURE does not exist, and referencing it raised AttributeError
                # from inside the error path itself — so every handled error
                # (record not found, not eligible, authentication expired) was
                # returned to the agent as a bare HTTP 500 "Unknown Error."
                request, G2PResponseStatus.ERROR, code, message
            ),
            response_body=body_cls(response_payload=None),
        )

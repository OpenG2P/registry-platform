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
                request, G2PResponseStatus.FAILURE, code, message
            ),
            response_body=body_cls(response_payload=None),
        )

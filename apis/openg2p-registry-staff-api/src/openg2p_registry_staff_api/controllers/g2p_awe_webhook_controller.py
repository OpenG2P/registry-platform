import logging

from fastapi import Request, Response
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import UnauthorizedError
from openg2p_fastapi_common.errors.base_exception import BaseAppException

from openg2p_registry_core.errors import G2PRegistryException
from openg2p_registry_core.helpers.awe_webhook_signature import AweWebhookSignatureError
from openg2p_registry_core.schemas.awe_webhook import AweWebhookDecisionResponse
from openg2p_registry_core.services import G2PAweWebhookService

from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PAWEWebhookController(BaseController):
    """Inbound AWE terminal-state webhooks (HMAC auth, no JWT)."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.tags += ["/awe"]
        self.router.prefix = "/awe"
        self.service = G2PAweWebhookService.get_component()

        self.router.add_api_route(
            "/webhooks/decision",
            self.receive_decision,
            response_model=AweWebhookDecisionResponse,
            methods=["POST"],
        )

    async def receive_decision(self, request: Request) -> AweWebhookDecisionResponse | Response:
        raw_body = await request.body()
        try:
            return await self.service.handle_decision_webhook(
                raw_body=raw_body,
                signature_header=request.headers.get("X-Approval-Signature"),
                timestamp_header=request.headers.get("X-Approval-Timestamp"),
                header_event_id=request.headers.get("X-Approval-Event-Id"),
            )
        except AweWebhookSignatureError as exc:
            _logger.warning("AWE webhook signature rejected: %s", exc)
            raise UnauthorizedError(message=str(exc)) from exc
        except G2PRegistryException as exc:
            _logger.error("AWE webhook processing failed: %s", exc.message)
            return Response(
                content='{"detail":"webhook processing failed"}',
                status_code=422,
                media_type="application/json",
            )
        except BaseAppException:
            raise
        except Exception:
            _logger.exception("Unexpected error handling AWE webhook")
            return Response(
                content='{"detail":"internal error"}',
                status_code=500,
                media_type="application/json",
            )

import json
from urllib.parse import parse_qs

import httpx
from openg2p_fastapi_common.service import BaseService

from ..config import Settings

_config = Settings.get_config(strict=False)


class WebsubHelper(BaseService):
    def __init__(self):
        super().__init__()
        self.websub_base_url = _config.websub_base_url

    async def register_topic(self, topic: str):
        await self._post(
            {
                "hub.mode": "register",
                "hub.topic": topic,
            }
        )

    async def deregister_topic(self, topic: str):
        await self._post(
            {
                "hub.mode": "deregister",
                "hub.topic": topic,
            }
        )

    async def publish(self, topic: str, payload: dict):
        await self._post(
            {
                "hub.mode": "publish",
                "hub.topic": topic,
                "hub.content": json.dumps(payload),
            }
        )

    async def _post(self, data: dict) -> None:
        url = f"{self.websub_base_url}/hub/"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data)
        self._raise_for_hub(response)

    @staticmethod
    def _raise_for_hub(response: httpx.Response) -> None:
        """Fail on HTTP errors and on hub.mode=denied, which this hub returns as HTTP 200."""
        response.raise_for_status()
        fields = parse_qs(response.text or "", keep_blank_values=True)
        if fields.get("hub.mode", [""])[0] == "denied":
            reason = fields.get("hub.reason", ["denied"])[0]
            raise httpx.HTTPStatusError(
                f"WebSub hub denied the request: {reason}",
                request=response.request,
                response=response,
            )

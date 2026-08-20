import logging
from typing import Any, Optional

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from openg2p_registry_core.models import G2PVcIssuance, VcIssuanceStatusEnum
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import Settings

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class IssuanceLogService(BaseService):
    """Writes the registry-side record of what was issued, to whom, by whom.

    Certify keeps its own ledger of credentials, but cannot know the registrant,
    the agent, or the authentication behind an issuance — it is deliberately
    decoupled from the registry. This log is that missing half, and the two join
    on `credential_id`.

    Failures are recorded too. An issuance that got as far as authenticating a
    beneficiary and then failed is exactly the event someone will later need to
    explain, and a log that only holds successes cannot explain it.
    """

    def _session_maker(self):
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    async def record(
        self,
        *,
        register_id: str,
        internal_record_id: str,
        vc_type: str,
        issued_by: str,
        credential_id: Optional[str] = None,
        authentication_id: Optional[str] = None,
        status: str = VcIssuanceStatusEnum.issued.value,
        failure_reason: Optional[str] = None,
        reprint_of: Optional[str] = None,
    ) -> G2PVcIssuance:
        entry = G2PVcIssuance(
            register_id=register_id,
            internal_record_id=internal_record_id,
            vc_type=vc_type,
            credential_id=credential_id,
            authentication_id=authentication_id,
            issued_by=issued_by,
            status=status,
            failure_reason=failure_reason,
            reprint_of=reprint_of,
        )
        async with self._session_maker()() as session:
            session.add(entry)
            await session.commit()
        _logger.info(
            "Recorded VC issuance %s (record=%s type=%s status=%s)",
            entry.issuance_id,
            internal_record_id,
            vc_type,
            status,
        )
        return entry

    @staticmethod
    def credential_id_of(credential: Any) -> Optional[str]:
        """Certify's identifier for the credential, if it carries one."""
        if isinstance(credential, dict):
            for key in ("id", "credentialId"):
                value = credential.get(key)
                if isinstance(value, str) and value:
                    return value
            inner = credential.get("credential")
            if isinstance(inner, dict):
                value = inner.get("id")
                if isinstance(value, str) and value:
                    return value
        return None

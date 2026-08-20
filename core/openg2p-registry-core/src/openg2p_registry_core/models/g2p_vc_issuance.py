import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from openg2p_fastapi_common.models import BaseORMModel


class VcIssuanceStatusEnum(str, enum.Enum):
    issued = "ISSUED"
    failed = "FAILED"


class G2PVcIssuance(BaseORMModel):
    """Registry-side event log of verifiable credentials issued for a record.

    This is deliberately a *log of events*, not a copy of the credential. Inji
    Certify keeps its own ledger of what was issued (credential id, type, dates,
    status) but — by Phase-1 design — knows nothing about the registrant, the
    agent, or how the beneficiary was authenticated. That half of the story is a
    registry concern and lives here. The two join on `credential_id`.

    Nothing of the credential body, its claims, or the rendered PDF is stored:
    duplicating registrant PII into a second place would create a competing
    source of truth for no benefit.
    """

    __tablename__ = "g2p_vc_issuances"

    issuance_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )

    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # The record the credential was issued for. Issuance is always keyed on this,
    # never on an identifier the agent typed — that only locates the record.
    internal_record_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # Which credential definition was issued (a vc_definitions config_id).
    vc_type: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # Certify's identifier for the credential — the join key into certify.ledger.
    # Null when the issuance failed before Certify returned one.
    credential_id: Mapped[str] = mapped_column(String, nullable=True, index=True)

    # The beneficiary authentication that authorised this issuance
    # (g2p_registrant_authentications.authentication_id). Not a DB-level foreign
    # key: the authentication may be purged under a shorter retention than the
    # issuance log, and losing it must not delete the audit record.
    authentication_id: Mapped[str] = mapped_column(String, nullable=True, index=True)

    # The agent who performed the issuance.
    issued_by: Mapped[str] = mapped_column(String, nullable=False, index=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    status: Mapped[str] = mapped_column(
        String, nullable=False, default=VcIssuanceStatusEnum.issued.value
    )
    failure_reason: Mapped[str] = mapped_column(String, nullable=True)

    # Set when this issuance replaces a lost or damaged paper credential. Because
    # the credential body is never stored, a reprint is necessarily a re-issue:
    # a fresh authentication and a new credential, linked back to the previous one.
    reprint_of: Mapped[str] = mapped_column(String, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    __table_args__ = (
        Index("idx_g2p_vc_issuances_record_issued_at", "internal_record_id", "issued_at"),
    )

import uuid

from sqlalchemy import Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_fastapi_common.models import BaseORMModel


class G2PRegistryDataPolicy(BaseORMModel):
    """
    Record-level data access policy for a register.
    policy_mnemonic is published to Keycloak as a client role DP_<policy_mnemonic>.
    """

    __tablename__ = "g2p_registry_data_policies"

    policy_id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    policy_mnemonic: Mapped[str] = mapped_column(String, nullable=False, index=True)
    policy_description: Mapped[str | None] = mapped_column(String, nullable=True)
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    policy_type: Mapped[str] = mapped_column(String, nullable=False)
    policy_filter_expression: Mapped[JSON] = mapped_column(JSON, nullable=False)

    __table_args__ = (
        Index(
            "ix_g2p_registry_data_policies_reg_mnemonic_unique",
            "register_id",
            "policy_mnemonic",
            unique=True,
        ),
    )

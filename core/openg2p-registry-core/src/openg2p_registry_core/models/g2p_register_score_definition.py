import uuid

from sqlalchemy import Boolean, JSON, Index, String
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_fastapi_common.models import BaseORMModel


class G2PRegisterScoreDefinition(BaseORMModel):
    """
    Stores which score types are configured for a register and which attributes
    contribute to each score.
    """

    __tablename__ = "g2p_register_score_definitions"

    score_definition_id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    register_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # Used as factory lookup key in the extensions repository (e.g. "PMT_SCORE")
    score_type: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # JSON list of field paths that contribute to this score (e.g. ["income", "assets.land_area"])
    contributing_attributes: Mapped[JSON] = mapped_column(JSON, nullable=False)

    # Optional extra config for the compute implementation
    score_config: Mapped[JSON] = mapped_column(JSON, nullable=True)

    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        # A register may only have one definition per score_type.
        Index(
            "ix_g2p_register_score_definitions_register_id_score_type_unique",
            "register_id",
            "score_type",
            unique=True,
        ),
    )


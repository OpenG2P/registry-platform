import uuid
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_fastapi_common.models import BaseORMModel


class G2PRegistryDocument(BaseORMModel):
    """
    Stores uploaded document metadata mapped to the underlying object storage.
    """
    __tablename__ = "g2p_registry_documents"

    document_id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    document_store_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
        index=True,
        unique=True
    )
    document_label: Mapped[str] = mapped_column(
        String,
        nullable=False
    )
    filename: Mapped[str] = mapped_column(
        String,
        nullable=False
    )

import uuid
from sqlalchemy import Boolean, String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from openg2p_fastapi_common.models import BaseORMModel


class G2PAttribute(BaseORMModel):
    __tablename__ = "g2p_attributes"

    attribute_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    attribute_code: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    attribute_display: Mapped[str] = mapped_column(String, nullable=False)
    is_hierarchical: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class G2PAttributeValue(BaseORMModel):
    __tablename__ = "g2p_attribute_values"

    value_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    attribute_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
        index=True,
    )
    value_code: Mapped[str] = mapped_column(String, nullable=False, index=True)
    value_display: Mapped[str] = mapped_column(String, nullable=False)
    parent_value_id: Mapped[str] = mapped_column(
        String,
        nullable=True,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)



class G2PAttributeValueRole(BaseORMModel):
    """Semantic roles a code-list value plays — see openg2p-data/packs/roles.json.

    A SEPARATE TABLE rather than a column on g2p_attribute_values, deliberately.
    This platform creates tables with SQLAlchemy's create_all, which creates
    tables that are missing but never adds columns to tables that already exist.
    A new column on the existing model would therefore be declared by the ORM and
    absent from every database upgraded from an earlier release, and every read of
    an attribute value would fail. A new table is created cleanly on upgrade and
    is simply empty until something seeds it.

    The point of a role is that logic asks for it rather than for a literal.
    `relationship_to_head = 'SELF'` is true only for countries that happen to use
    that code, and it fails silently — returning zero heads of household rather
    than an error — for every country that does not.
    """

    __tablename__ = "g2p_attribute_value_roles"

    # (value_id, role) rather than a surrogate key: a value holds a given role
    # once or not at all, and saying so twice should be impossible, not merely
    # unusual.
    value_id: Mapped[str] = mapped_column(String, primary_key=True)
    role: Mapped[str] = mapped_column(String, primary_key=True, index=True)

    # Denormalised from g2p_attribute_values so a role can be resolved to its
    # list without a join — the lookup is on the hot path for anything that
    # validates an incoming value.
    attribute_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

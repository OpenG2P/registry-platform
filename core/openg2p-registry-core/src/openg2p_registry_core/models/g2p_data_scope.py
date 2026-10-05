"""Data scopes: the consent scopes this registry shares, as named groups of its own fields.

A scope is independent of any interoperability standard (DCI or other). Its ID
is ``<controller>.<name>`` where ``<controller>`` is the registry's consent
data-controller ID (setting ``consent_data_controller``); only ``name`` is
stored here, so the namespace follows the deployment's controller ID.

* ``g2p_data_scopes`` — one row per scope. Label, description and status may
  change; the name never does, and a scope is never deleted (a scope that is no
  longer offered is RETIRED and keeps its versions for consents given under it).
* ``g2p_data_scope_versions`` — the scope's field list over time. A version is
  immutable once written (a database trigger rejects UPDATE and DELETE); a
  changed field list is a new version, effective from when it was published.

``fields`` holds the field references as authored (``section:<mnemonic>``,
``<Register>.<field>``, ``<Register>.*``, ``<Register>.<record_type>.<field>``);
``resolved_fields`` the concrete references they meant when the version was
published (sections expanded), which is what enforcement uses — so a section
gaining a field later can never widen an existing version. ``renamed_fields``
maps a previous version's references to this version's when a field was
renamed, so consents given before the rename keep the field.

See ``G2PDataScopeService`` for loading, publishing and resolution.
"""

from datetime import datetime

from openg2p_fastapi_common.models import BaseORMModel
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .enum import DataScopeSourceEnum, DataScopeStatusEnum


def _utcnow() -> datetime:
    return datetime.utcnow()


class G2PDataScope(BaseORMModel):
    __tablename__ = "g2p_data_scopes"

    scope_name: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default=DataScopeStatusEnum.ACTIVE.value)
    # SECTION: derived from a register section; EXTENSION: from the extension's catalogue.
    source: Mapped[str] = mapped_column(String, nullable=False, default=DataScopeSourceEnum.SECTION.value)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    retired_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class G2PDataScopeVersion(BaseORMModel):
    __tablename__ = "g2p_data_scope_versions"

    scope_name: Mapped[str] = mapped_column(String, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    fields: Mapped[list] = mapped_column(JSONB, nullable=False)
    resolved_fields: Mapped[list] = mapped_column(JSONB, nullable=False)
    renamed_fields: Mapped[dict] = mapped_column(JSONB, nullable=True)
    effective_from: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

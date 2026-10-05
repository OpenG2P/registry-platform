from __future__ import annotations

import json

import pytest
from pydantic import ValidationError
from sqlalchemy import Float, Integer, JSON, create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.schema import CreateTable

from openg2p_registry_core.models.g2p_register import G2PGeo
from openg2p_registry_core.models.g2p_register_history import G2PGeoHistory
from openg2p_registry_core.schemas.g2p_register import G2PGeoSchema
from openg2p_registry_core.schemas.g2p_register_history import G2PGeoHistorySchema


class _GeoRecord(G2PGeo):
    """Minimal concrete model used to exercise clean-table inserts."""

    __tablename__ = "test_g2p_geo_float_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # SQLite does not compile PostgreSQL JSONB; this test only exercises the
    # inherited coordinate columns, so use its portable JSON equivalent.
    geo_code_hierarchy_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


@pytest.mark.parametrize("mixin", [G2PGeo, G2PGeoHistory])
def test_geo_orm_fields_are_nullable_floats(mixin):
    for field_name in ("latitude", "longitude", "altitude"):
        column = getattr(mixin, field_name).column
        assert isinstance(column.type, Float)
        assert column.nullable is True


@pytest.mark.parametrize("schema_class", [G2PGeoSchema, G2PGeoHistorySchema])
def test_geo_schemas_accept_numeric_seed_values(schema_class):
    schema = schema_class(
        latitude="8.980603",
        longitude=38.757762,
        altitude="286",
    )

    assert schema.latitude == pytest.approx(8.980603)
    assert schema.longitude == pytest.approx(38.757762)
    assert schema.altitude == pytest.approx(286.0)
    serialized = json.loads(schema.model_dump_json())
    assert all(
        isinstance(serialized[field_name], float)
        for field_name in ("latitude", "longitude", "altitude")
    )


@pytest.mark.parametrize("schema_class", [G2PGeoSchema, G2PGeoHistorySchema])
def test_geo_schemas_reject_malformed_values(schema_class):
    with pytest.raises(ValidationError):
        schema_class(latitude="not-a-coordinate")


def test_clean_postgresql_table_uses_float_coordinates():
    ddl = str(CreateTable(_GeoRecord.__table__).compile(dialect=postgresql.dialect()))

    for field_name in ("latitude", "longitude", "altitude"):
        assert f"{field_name} FLOAT" in ddl


def test_clean_table_insert_round_trips_coordinates_as_floats():
    engine = create_engine("sqlite://")
    _GeoRecord.metadata.create_all(engine, tables=[_GeoRecord.__table__])

    with Session(engine) as session:
        session.add(
            _GeoRecord(
                id=1,
                latitude="8.980603",
                longitude="38.757762",
                altitude="286",
            )
        )
        session.commit()

        stored = session.get(_GeoRecord, 1)

    assert stored is not None
    assert stored.latitude == pytest.approx(8.980603)
    assert stored.longitude == pytest.approx(38.757762)
    assert stored.altitude == pytest.approx(286.0)
    assert all(
        isinstance(getattr(stored, field_name), float)
        for field_name in ("latitude", "longitude", "altitude")
    )

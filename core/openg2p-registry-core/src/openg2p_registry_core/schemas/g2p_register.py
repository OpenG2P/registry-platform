from datetime import datetime, date
from typing import Any, Optional, get_args

from pydantic import BaseModel, model_validator


def _annotation_includes_date(annotation) -> bool:
    if annotation in (date, datetime):
        return True
    return any(
        arg is not type(None) and _annotation_includes_date(arg)
        for arg in get_args(annotation)
    )


def coerce_blank_dates_to_none(model_cls, data: Any) -> Any:
    """Treat blank date/datetime strings as null. Optional date fields allow None, not ''."""
    if not isinstance(data, dict):
        return data
    blank_dates = {
        name: None
        for name, field in model_cls.model_fields.items()
        if name in data
        and isinstance(data[name], str)
        and data[name].strip() == ""
        and _annotation_includes_date(field.annotation)
    }
    if not blank_dates:
        return data
    return {**data, **blank_dates}


class G2PTableBaseSchema(BaseModel):
    """Base schema for G2PTable fields."""

    internal_record_id: Optional[str] = None
    link_internal_record_id: Optional[str] = None


class G2PProgramRegisterBaseSchema(BaseModel):
    """Base schema for G2PProgramRegister fields."""

    internal_record_id: Optional[str] = None
    foundational_id: Optional[str] = None
    link_foundational_id: Optional[str] = None


class G2PRegisterBaseSchema(BaseModel):
    """Base schema for G2PRegister fields."""

    @model_validator(mode="before")
    @classmethod
    def empty_date_strings_to_none(cls, data: Any) -> Any:
        return coerce_blank_dates_to_none(cls, data)

    internal_record_id: Optional[str] = None
    functional_record_id: Optional[str] = None
    link_internal_record_id: Optional[str] = None
    link_foundational_id: Optional[str] = None
    record_name: Optional[str] = None
    record_image_document_id: Optional[str] = None
    record_status: Optional[str] = None
    record_status_reason: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    last_approved_at: Optional[datetime] = None
    last_approved_by: Optional[str] = None


class G2PPersonSchema(BaseModel):
    """Base schema for G2PPerson fields."""

    foundational_id: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    given_name: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    phone_numbers: Optional[list] = None
    emails: Optional[list] = None
    marital_status: Optional[str] = None
    occupation: Optional[str] = None
    income_level: Optional[str] = None
    language_code: Optional[str] = None
    education_level: Optional[str] = None
    registration_date: Optional[date] = None


class G2PGeoSchema(BaseModel):
    """Base schema for G2PGeo fields."""

    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    plus_code: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: Optional[str] = None
    geo_lowest_level_value_id: Optional[str] = None
    geo_code_hierarchy_json: Optional[dict] = None


class G2PGeoShapeSchema(BaseModel):
    """Base schema for G2PGeoShape fields."""

    shape_type: Optional[str] = None
    shape_coordinates_json: Optional[dict] = None
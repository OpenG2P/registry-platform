SECTION_DOCUMENTS_FIELD = "documents"


def change_payload_to_storage_dict(payload) -> dict:
    """Serialize a row while preserving omitted vs explicit document intent."""
    if hasattr(payload, "model_dump"):
        serialized = payload.model_dump()
        fields_set = getattr(payload, "model_fields_set", set())
        if SECTION_DOCUMENTS_FIELD not in fields_set:
            serialized.pop(SECTION_DOCUMENTS_FIELD, None)
    else:
        serialized = dict(payload or {})
    return serialized


def domain_fields_from_change_payload(payload) -> dict:
    """Return only fields that may be passed to domain/ORM schemas."""
    serialized = change_payload_to_storage_dict(payload)
    serialized.pop(SECTION_DOCUMENTS_FIELD, None)
    return serialized

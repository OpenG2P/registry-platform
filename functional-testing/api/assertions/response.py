"""Response-envelope assertion helpers."""

from __future__ import annotations

from typing import Any


def assert_success(body: dict[str, Any], context: str = "") -> dict[str, Any] | list[Any] | Any:
    header = body.get("response_header") or {}
    status = header.get("response_status")
    assert status != "ERROR", (
        f"{context}: expected success, got ERROR "
        f"{header.get('response_error_code')}: {header.get('response_error_message')}"
    )
    return (body.get("response_body") or {}).get("response_payload")


def assert_fields_present(payload: dict[str, Any], *keys: str, context: str = "") -> None:
    missing = [k for k in keys if k not in payload or payload.get(k) in (None, "")]
    assert not missing, f"{context}: missing fields {missing} in {payload!r}"


def assert_status_fields(
    payload: dict[str, Any],
    *,
    draft_status: str | None = None,
    approval_status: str | None = None,
    context: str = "",
) -> None:
    if draft_status is not None:
        got = str(payload.get("draft_status") or "").upper()
        assert got == draft_status.upper(), (
            f"{context}: draft_status expected {draft_status!r}, got {got!r}"
        )
    if approval_status is not None:
        got = str(payload.get("approval_status") or "").upper()
        assert got == approval_status.upper(), (
            f"{context}: approval_status expected {approval_status!r}, got {got!r}"
        )


def unwrap_subject_record(subject_payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize get_subject_record payload to a flat record dict."""
    if not isinstance(subject_payload, dict):
        raise AssertionError(f"subject payload must be dict, got {type(subject_payload).__name__}")
    record = subject_payload.get("record")
    if isinstance(record, dict):
        return record
    return subject_payload


def assert_values_equal(api_value: Any, db_value: Any, *, field: str, context: str) -> None:
    """Strict equality for dual validation (normalize common type drift)."""
    if api_value is None and db_value is None:
        return
    assert api_value is not None, f"{context}: API missing {field} (DB={db_value!r})"
    assert db_value is not None, f"{context}: DB missing {field} (API={api_value!r})"

    # Dates / datetimes → ISO date prefix
    api_n = _normalize(api_value)
    db_n = _normalize(db_value)
    assert api_n == db_n, (
        f"{context}: {field} mismatch API={api_value!r} DB={db_value!r} "
        f"(normalized {api_n!r} vs {db_n!r})"
    )


def _normalize(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, list):
        return [_normalize(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _normalize(v) for k, v in sorted(value.items(), key=lambda kv: str(kv[0]))}
    text = str(value).strip()
    # date / datetime → YYYY-MM-DD when possible
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    try:
        return float(text)
    except ValueError:
        return text

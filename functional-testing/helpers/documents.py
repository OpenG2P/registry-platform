"""Document upload helper for Tier-2 pipeline / enqueue scenarios."""

from __future__ import annotations

import io
from typing import Any

from assertions.response import assert_success
from helpers.http import StaffClient

# Minimal valid PDF — DOCUMENTS bucket allows jpeg/jpg/pdf/png/webp (DOC-VAL-002).
_MINIMAL_PDF = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj
trailer<</Root 1 0 R>>
%%EOF
"""

# TEMPLATES bucket only accepts .json.j2 text.
_MINIMAL_TEMPLATE = b'{"func_tier2": true}\n'


def upload_text_document(
    staff: StaffClient,
    *,
    filename: str = "func-tier2.pdf",
    content: bytes | None = None,
) -> str:
    """Upload a tiny DOCUMENTS-bucket file via multipart; return document_id.

    Despite the historical name, files must use an allowed extension (pdf/png/…).
    """
    body = content if content is not None else _MINIMAL_PDF
    if not filename.lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".webp")):
        filename = f"{filename.rsplit('.', 1)[0]}.pdf"
        if content is None:
            body = _MINIMAL_PDF
    files = [("documents", (filename, io.BytesIO(body), "application/pdf"))]
    response = staff.post_multipart(
        "/documents/upload_documents",
        files=files,
        data={"bucket": "documents"},
    )
    return _first_document_id(response)


def upload_template_document(
    staff: StaffClient,
    *,
    filename: str = "func-tier2.json.j2",
    content: bytes | None = None,
) -> str:
    """Upload a Jinja JSON template into the TEMPLATES bucket; return document_id."""
    if not filename.lower().endswith(".json.j2"):
        filename = f"{filename.rsplit('.', 1)[0]}.json.j2"
    body = content if content is not None else _MINIMAL_TEMPLATE
    files = [("documents", (filename, io.BytesIO(body), "text/plain"))]
    response = staff.post_multipart(
        "/documents/upload_documents",
        files=files,
        data={"bucket": "templates"},
    )
    return _first_document_id(response)


def _first_document_id(response: dict[str, Any]) -> str:
    payload = assert_success(response, "upload_documents")
    docs = (payload or {}).get("documents") if isinstance(payload, dict) else None
    if not isinstance(docs, list) or not docs:
        raise AssertionError(f"upload_documents returned no documents: {payload!r}")
    doc_id = docs[0].get("document_id")
    assert doc_id, f"missing document_id in {docs[0]!r}"
    return str(doc_id)


def delete_documents(staff: StaffClient, document_ids: list[str]) -> dict[str, Any]:
    return staff.post_json(
        "/documents/delete_documents",
        {"document_ids": document_ids},
    )

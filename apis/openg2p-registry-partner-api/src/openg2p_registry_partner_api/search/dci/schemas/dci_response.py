import enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


# ============================================================
# Status Enum
# ============================================================

class DciStatusCode(enum.Enum):
    RECEIVED = "rcvd"
    PENDING = "pdng"
    SUCCESS = "succ"
    REJECTED = "rjct"


class DciSearchStatusReasonCode(enum.Enum):
    REFERENCE_ID_INVALID = "rjct.reference_id.invalid"
    REFERENCE_ID_DUPLICATE = "rjct.reference_id.duplicate"
    TIMESTAMP_INVALID = "rjct.timestamp.invalid"
    SEARCH_CRITERIA_INVALID = "rjct.search_criteria.invalid"
    FILTER_INVALID = "rjct.filter.invalid"
    SORT_INVALID = "rjct.sort.invalid"
    PAGINATION_INVALID = "rjct.pagination.invalid"
    SEARCH_TOO_MANY_RECORDS_FOUND = "rjct.search.too_many_records_found"


# ============================================================
# Search Result Data (registry payload)
# ============================================================

class DciSearchResultData(BaseModel):
    """
    SearchResponse.search_response[i].data

    Registry response payload.
    Deep registry objects are intentionally treated as opaque JSON.
    """
    version: str = Field(
        default="1.0.0",
        description="Schema version",
    )

    reg_type: Optional[str] = Field(
        default=None,
        description=(
            "Register mnemonic echoed from the search request (`g2p_register_definitions.register_mnemonic`), "
            "e.g. Farmer, Household, Individual."
        ),
    )

    reg_record_type: Optional[str] = Field(
        default=None,
        description="Registry record type, e.g. spdci-extensions-dci:Farmer",
    )

    reg_records: List[Dict[str, Any]] = Field(
        description="List of registry records (opaque JSON-LD objects)",
    )

    class Config:
        extra = "allow"


# ============================================================
# Pagination
# ============================================================

class DciSearchResultPagination(BaseModel):
    """
    SearchResponse.search_response[i].pagination
    """
    page_size: int = Field(description="Number of records per page")
    page_number: int = Field(description="Current page number (1-based)")
    total_count: Optional[int] = Field(
        default=None,
        description="Total number of records matching query",
    )


# ============================================================
# Search Response Item
# ============================================================

class DciSearchResponseItem(BaseModel):
    """
    One entry in message.search_response[]
    """
    reference_id: str = Field(
        max_length=99,
        description="Reference id from corresponding SearchRequest",
    )

    timestamp: str = Field(
        description="ISO-8601 timestamp",
    )

    status: str = Field(
        description='Enum: "rcvd", "pdng", "succ", "rjct"',
    )

    status_reason_code: Optional[str] = Field(
        default=None,
        description="Reason code explaining the status",
    )

    status_reason_message: Optional[str] = Field(
        default=None,
        max_length=999,
        description="Human-readable status reason message",
    )

    data: Optional[DciSearchResultData] = Field(
        default=None,
        description="Search result data payload",
    )

    pagination: Optional[DciSearchResultPagination] = Field(
        default=None,
        description="Pagination information for this result",
    )

    locale: Optional[str] = Field(
        default=None,
        max_length=10,
        description="Locale, e.g. 'en' or 'eng'",
    )

    class Config:
        extra = "allow"


# ============================================================
# Message Body
# ============================================================

class DciSearchResponse(BaseModel):
    """
    message payload for /registry/on-search
    """
    transaction_id: str = Field(
        max_length=99,
        description="Transaction identifier",
    )

    correlation_id: str = Field(
        max_length=99,
        description="Correlation identifier assigned by responder",
    )

    search_response: List[DciSearchResponseItem] = Field(
        min_items=0,
        description="Array of search response entries",
    )


# ============================================================
# Response Header
# ============================================================

class DciResponseHeader(BaseModel):
    """
    Message header for on-search responses
    """
    version: str = Field(default="1.0.0")
    message_id: str
    message_ts: str
    action: str

    status: Optional[str] = None
    status_reason_code: Optional[str] = None
    status_reason_message: Optional[str] = None

    total_count: Optional[int] = None
    completed_count: Optional[int] = None

    sender_id: str
    receiver_id: str
    sender_uri: Optional[str] = None

    is_msg_encrypted: bool = False
    meta: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        extra = "allow"


# ============================================================
# Encrypted Message (optional alternative payload)
# ============================================================

class DciEncryptedMessage(BaseModel):
    header: Dict[str, Any]
    ciphertext: str
    encrypted_key: str
    tag: str
    iv: str


# ============================================================
# Envelope
# ============================================================

class DciSearchResponseEnvelope(BaseModel):
    """
    Envelope for POST /registry/on-search

    {
      "signature": "...",
      "header": { ... },
      "message": { ...SearchResponse... } | { ...EncryptedMessage... }
    }
    """
    signature: str = Field(
        description="Signature of {header}+{message}",
    )

    header: DciResponseHeader

    message: Union[DciSearchResponse, DciEncryptedMessage]

    class Config:
        extra = "allow"

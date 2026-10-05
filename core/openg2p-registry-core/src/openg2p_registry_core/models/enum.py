from enum import StrEnum


class ApprovalStatusEnum(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ChangeRequestSourceEnum(StrEnum):
    # TODO: REMOVE INATKE_FORM and update worker
    PARTNER = "PARTNER"
    INGESTION_PIPELINE = "PARTNER"
    INTAKE_FORM = "INTAKE_FORM"
    # DIRECT -> STAFF_PORTAL
    STAFF_PORTAL = "STAFF_PORTAL"
    BENEFICIARY_PORTAL = "BENEFICIARY_PORTAL"
    AGENT_PORTAL = "AGENT_PORTAL"


class ChangeRequestStatusEnum(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class DeduplicationStatusEnum(StrEnum):
    PENDING = "PENDING"
    INPROGRESS = "INPROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ChangeActionEnum(StrEnum):
    ADD = "ADD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    NO_CHANGE = "NO_CHANGE"


class RegistryDataPolicyTypeEnum(StrEnum):
    ALLOW = "ALLOW"
    DISALLOW = "DISALLOW"


class PolicyTargetEnum(StrEnum):
    REGISTER_RECORD = "REGISTER_RECORD"
    GEO = "GEO"
    ATTRIBUTE = "ATTRIBUTE"


class GenderEnum(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHERS = "OTHERS"
    UNKNOWN = "UNKNOWN"


class IntakeFormStatusEnum(StrEnum):
    DRAFT = "DRAFT"
    FINAL = "FINAL"


class MaritalStatusEnum(StrEnum):
    SINGLE = "SINGLE"
    MARRIED = "MARRIED"
    DIVORCED = "DIVORCED"
    WIDOWED = "WIDOWED"
    SEPARATED = "SEPARATED"
    UNKNOWN = "UNKNOWN"


class PipelineActionEnum(StrEnum):
    ADD = "ADD"
    UPDATE = "UPDATE"


class ProcessStatusEnum(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ExportFormatEnum(StrEnum):
    XLSX = "XLSX"
    ZIP_CSV = "ZIP_CSV"


class ExportSelectionModeEnum(StrEnum):
    SELECTED = "SELECTED"
    SEARCH_FILTER = "SEARCH_FILTER"


class RecordStatusEnum(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class RegisterPurposeEnum(StrEnum):
    REGISTER = "REGISTER"
    PROGRAM_REGISTER = "PROGRAM_REGISTER"
    TABLE = "TABLE"
    CORE_TABLE = "CORE_TABLE"
    # Append-only activity register (see models/g2p_activity.py). Not a record
    # store: no change requests, history, intake forms, dedup or functional IDs.
    ACTIVITY = "ACTIVITY"


class ActivityStatusEnum(StrEnum):
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"
    VOIDED = "VOIDED"


class ActivityVerificationStatusEnum(StrEnum):
    NOT_REQUIRED = "NOT_REQUIRED"
    SUBMITTED = "SUBMITTED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class ActivityContextStatusEnum(StrEnum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class ActivityChannelEnum(StrEnum):
    STAFF_PORTAL = "STAFF_PORTAL"
    AGENT_PORTAL = "AGENT_PORTAL"
    PARTNER = "PARTNER"
    ODK = "ODK"
    IMPORT_FILE = "IMPORT_FILE"
    SYSTEM = "SYSTEM"


class ActivityOutboxEventEnum(StrEnum):
    APPENDED = "APPENDED"
    SUPERSEDED = "SUPERSEDED"
    VOIDED = "VOIDED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class ReferenceKindEnum(StrEnum):
    # A record in a register of this registry instance.
    LOCAL_RECORD = "LOCAL_RECORD"
    # A value of a Master Data code list (read through MDS's catalogue API).
    ATTRIBUTE = "ATTRIBUTE"
    # A geo level value from Master Data.
    GEO = "GEO"
    # An identifier held by another system (another registry, Fayda).
    EXTERNAL = "EXTERNAL"


class ReferenceValidationModeEnum(StrEnum):
    STRICT = "STRICT"  # unresolved → reject
    LENIENT = "LENIENT"  # unresolved → accept with a warning
    NONE = "NONE"  # not checked


class AwePolicyScopeEnum(StrEnum):
    """Which registry artefact an AWE policy configuration row applies to."""

    REGISTER = "REGISTER"
    INTAKE_FORM = "INTAKE_FORM"
    SECTION = "SECTION"


class ShapeTypeEnum(StrEnum):
    POINT = "POINT"
    LINESTRING = "LINESTRING"
    CIRCLE = "CIRCLE"
    BOX = "BOX"
    POLYGON = "POLYGON"
    MULTIPOINT = "MULTIPOINT"
    MULTILINESTRING = "MULTILINESTRING"
    MULTIPOLYGON = "MULTIPOLYGON"
    GEOMETRYCOLLECTION = "GEOMETRYCOLLECTION"


class InputMechanismTypeEnum(StrEnum):
    INTAKE_FORM = "INTAKE_FORM"
    IMPORT_FILE = "IMPORT_FILE"
    VERIFIABLE_CREDENTIAL = "VERIFIABLE_CREDENTIAL"


class DocumentBucket(StrEnum):
    """
    Logical buckets for document storage. Bucket names are hard-set:
    the physical bucket name is always the enum value.
    """

    DEFAULT = "default"
    TEMPLATES = "templates"
    DOCUMENTS = "documents"
    IMPORT_FILES = "import-files"
    EXPORT_FILES = "export-files"


class DocumentHistoryEventTypeEnum(StrEnum):
    ADD = "ADD"
    REMOVE = "REMOVE"


class DataScopeStatusEnum(StrEnum):
    ACTIVE = "ACTIVE"
    # No longer offered: kept, with its versions, for consents given under it.
    RETIRED = "RETIRED"


class DataScopeSourceEnum(StrEnum):
    SECTION = "SECTION"  # one per register section, derived by the platform
    EXTENSION = "EXTENSION"  # from the extension's catalogue (meta_data/data-scopes/*.json)

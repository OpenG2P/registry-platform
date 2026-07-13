"""Reusable file validation for icons, documents, and other uploads."""

from __future__ import annotations

import base64
import binascii
import io
import re
from dataclasses import dataclass
from typing import FrozenSet, Optional, Set

from PIL import Image, UnidentifiedImageError

from ..errors import G2PRegistryErrorCodes, G2PRegistryException

_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[\w/+.-]+);base64,(?P<data>.+)$",
    re.IGNORECASE | re.DOTALL,
)

_PIL_FORMAT_TO_MIME = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "GIF": "image/gif",
}


@dataclass(frozen=True)
class FileValidationProfile:
    allowed_mime_types: FrozenSet[str]
    allowed_extensions: FrozenSet[str]
    max_bytes: int
    max_width: Optional[int] = None
    max_height: Optional[int] = None
    require_filename: bool = False


@dataclass(frozen=True)
class FileValidationResult:
    mime_type: str
    size: int
    width: Optional[int] = None
    height: Optional[int] = None


IMAGE_ICON_PROFILE = FileValidationProfile(
    allowed_mime_types=frozenset({"image/png", "image/jpeg", "image/webp"}),
    allowed_extensions=frozenset({"png", "jpg", "jpeg", "webp"}),
    max_bytes=1 * 1024 * 1024,
    max_width=1024,
    max_height=1024,
    require_filename=False,
)


def _raise(code: G2PRegistryErrorCodes, message: str) -> None:
    raise G2PRegistryException(code=code.value[1], message=message)


def validate_filename(filename: str, profile: FileValidationProfile) -> None:
    """Reject unsafe names, multiple extensions, or non-allowlisted extensions."""
    if not filename or not filename.strip():
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_NAME,
            "Filename is required.",
        )

    name = filename.strip()
    if "\x00" in name or "/" in name or "\\" in name:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_NAME,
            "Filename contains invalid characters.",
        )

    # Basename only (defense if a path slipped through)
    basename = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if basename.startswith(".") or basename.endswith("."):
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_NAME,
            "Filename must have a single valid extension.",
        )

    parts = basename.split(".")
    if len(parts) != 2:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_NAME,
            "Filename must contain exactly one extension "
            "(multiple or missing extensions are not allowed).",
        )

    stem, extension = parts[0], parts[1].lower()
    if not stem:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_NAME,
            "Filename must have a non-empty name before the extension.",
        )

    allowed: Set[str] = {ext.lower() for ext in profile.allowed_extensions}
    if extension not in allowed:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_TYPE,
            f"File extension '.{extension}' is not allowed. "
            f"Allowed: {', '.join(sorted(allowed))}.",
        )


def validate_file_bytes(
    data: bytes,
    profile: FileValidationProfile,
    filename: Optional[str] = None,
) -> FileValidationResult:
    """Validate size, optional filename, content MIME (via Pillow), and dimensions."""
    if profile.require_filename and not filename:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_NAME,
            "Filename is required.",
        )
    if filename is not None:
        validate_filename(filename, profile)

    if not data:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_CONTENT,
            "File content is empty.",
        )

    size = len(data)
    if size > profile.max_bytes:
        _raise(
            G2PRegistryErrorCodes.FILE_TOO_LARGE,
            f"File size ({size} bytes) exceeds maximum of {profile.max_bytes} bytes.",
        )

    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            pil_format = (image.format or "").upper()
            width, height = image.size
    except UnidentifiedImageError:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_CONTENT,
            "File content could not be identified as a valid image.",
        )
    except OSError as exc:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_CONTENT,
            f"File content could not be decoded: {exc}",
        )

    mime_type = _PIL_FORMAT_TO_MIME.get(pil_format)
    if not mime_type or mime_type not in profile.allowed_mime_types:
        allowed = ", ".join(sorted(profile.allowed_mime_types))
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_TYPE,
            f"Detected file type '{pil_format or 'unknown'}' is not allowed. "
            f"Allowed MIME types: {allowed}.",
        )

    if profile.max_width is not None and width > profile.max_width:
        _raise(
            G2PRegistryErrorCodes.INVALID_IMAGE_DIMENSIONS,
            f"Image width ({width}px) exceeds maximum of {profile.max_width}px.",
        )
    if profile.max_height is not None and height > profile.max_height:
        _raise(
            G2PRegistryErrorCodes.INVALID_IMAGE_DIMENSIONS,
            f"Image height ({height}px) exceeds maximum of {profile.max_height}px.",
        )

    return FileValidationResult(
        mime_type=mime_type,
        size=size,
        width=width,
        height=height,
    )


def _decode_base64_payload(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_CONTENT,
            "Invalid base64 encoding.",
        )
        raise  # pragma: no cover — _raise always raises


def validate_base64_image(
    value: str,
    profile: FileValidationProfile = IMAGE_ICON_PROFILE,
    filename: Optional[str] = None,
) -> str:
    """
    Validate a base64 or data-URL image and return a normalized data URL
    whose MIME matches the sniffed content.
    """
    if value is None:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_CONTENT,
            "Image value is required.",
        )

    raw = value.strip()
    if not raw:
        _raise(
            G2PRegistryErrorCodes.INVALID_FILE_CONTENT,
            "Image value is empty.",
        )

    match = _DATA_URL_RE.match(raw)
    if match:
        payload = "".join(match.group("data").split())
    else:
        # Strip optional whitespace/newlines from raw base64
        payload = "".join(raw.split())

    data = _decode_base64_payload(payload)
    result = validate_file_bytes(data, profile, filename=filename)
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{result.mime_type};base64,{encoded}"

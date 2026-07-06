import re
import secrets
from datetime import datetime

from ..config import Settings

_config = Settings.get_config(strict=False)

APPLICATION_REFERENCE_PATTERN = re.compile(r"^\d{8}-\d{5}\d+$")


def generate_application_reference(now: datetime | None = None) -> str:
    """
    Generate a customer-facing application reference.

    Format: YYYYMMDD-SSSSS<randomDigits>
    - YYYYMMDD: current date
    - SSSSS: zero-padded seconds since midnight (00000-86399)
    - randomDigits: length from registry_core_application_reference_random_digits config
    """
    reference_time = now or datetime.now()
    date_part = reference_time.strftime("%Y%m%d")
    seconds_since_midnight = (
        reference_time.hour * 3600 + reference_time.minute * 60 + reference_time.second
    )
    seconds_part = f"{seconds_since_midnight:05d}"
    random_digits = _config.application_reference_random_digits
    random_part = f"{secrets.randbelow(10**random_digits):0{random_digits}d}"
    return f"{date_part}-{seconds_part}{random_part}"

"""Ethiopian calendar (Amete Mihret) ↔ Gregorian conversion.

Dates are stored in the Gregorian calendar and entered or displayed in the
Ethiopian calendar. The Ethiopian year has twelve 30-day months and a
thirteenth month (Pagume) of 5 days, or 6 in the year before a Gregorian-style
leap: Ethiopian year Y is a leap year when Y % 4 == 3.

Conversion goes through the Julian Day Number (JDN). The Amete Mihret epoch
(1 Meskerem 1 EC) is JDN 1724221.
"""

import re
from datetime import date

_ETHIOPIAN_EPOCH_JDN = 1724221

_EC_DATE_PATTERN = re.compile(r"^\s*(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,2})\s*$")


class EthiopianDateError(ValueError):
    pass


def is_ethiopian_leap_year(year: int) -> bool:
    return year % 4 == 3


def _validate(year: int, month: int, day: int) -> None:
    if year < 1:
        raise EthiopianDateError(f"Invalid Ethiopian year {year}")
    if not 1 <= month <= 13:
        raise EthiopianDateError(f"Invalid Ethiopian month {month}")
    max_day = 30 if month <= 12 else (6 if is_ethiopian_leap_year(year) else 5)
    if not 1 <= day <= max_day:
        raise EthiopianDateError(f"Invalid day {day} for Ethiopian month {month} of {year}")


def ethiopian_to_jdn(year: int, month: int, day: int) -> int:
    _validate(year, month, day)
    return _ETHIOPIAN_EPOCH_JDN + 365 * (year - 1) + year // 4 + 30 * (month - 1) + day - 1


def jdn_to_ethiopian(jdn: int) -> tuple[int, int, int]:
    offset = jdn - _ETHIOPIAN_EPOCH_JDN
    # Each 4-year cycle is 1461 days. Year 3 of the cycle (Y % 4 == 3) is the
    # leap year, so years start at day 0, 365, 730 and 1096 of the cycle.
    cycle, remainder = divmod(offset, 1461)
    year_starts = (0, 365, 730, 1096)
    year_in_cycle = max(i for i, start in enumerate(year_starts) if remainder >= start)
    day_of_year = remainder - year_starts[year_in_cycle]
    year = 4 * cycle + year_in_cycle + 1
    month = day_of_year // 30 + 1
    day = day_of_year % 30 + 1
    return year, month, day


def gregorian_to_jdn(value: date) -> int:
    return value.toordinal() + 1721425


def jdn_to_gregorian(jdn: int) -> date:
    return date.fromordinal(jdn - 1721425)


def ethiopian_to_gregorian(year: int, month: int, day: int) -> date:
    return jdn_to_gregorian(ethiopian_to_jdn(year, month, day))


def gregorian_to_ethiopian(value: date) -> tuple[int, int, int]:
    return jdn_to_ethiopian(gregorian_to_jdn(value))


def parse_ethiopian_date(value: str) -> date:
    """Parse "YYYY-MM-DD" (also "/" or ".") in the Ethiopian calendar and return the Gregorian date."""
    match = _EC_DATE_PATTERN.match(value or "")
    if not match:
        raise EthiopianDateError(f"Not an Ethiopian date (YYYY-MM-DD): {value!r}")
    year, month, day = (int(part) for part in match.groups())
    return ethiopian_to_gregorian(year, month, day)


def format_ethiopian_date(value: date) -> str:
    year, month, day = gregorian_to_ethiopian(value)
    return f"{year:04d}-{month:02d}-{day:02d}"

from datetime import date, timedelta

import pytest

from openg2p_registry_core.helpers.ethiopian_calendar import (
    EthiopianDateError,
    ethiopian_to_gregorian,
    format_ethiopian_date,
    gregorian_to_ethiopian,
    parse_ethiopian_date,
)


@pytest.mark.parametrize(
    "ethiopian, gregorian",
    [
        ((2017, 1, 1), date(2024, 9, 11)),  # Enkutatash 2017 EC
        ((2016, 1, 1), date(2023, 9, 12)),  # year after an Ethiopian leap year starts on 12 Sep
        ((2015, 13, 6), date(2023, 9, 11)),  # Pagume 6 exists in leap year 2015
        ((2018, 1, 1), date(2025, 9, 11)),
        ((2012, 4, 28), date(2020, 1, 7)),  # Genna falls on Tahsas 28 after a leap year
        ((2016, 5, 11), date(2024, 1, 20)),  # Timket 2016
    ],
)
def test_known_dates(ethiopian, gregorian):
    assert ethiopian_to_gregorian(*ethiopian) == gregorian
    assert gregorian_to_ethiopian(gregorian) == ethiopian


def test_round_trip_over_several_cycles():
    day = date(2015, 1, 1)
    while day < date(2031, 1, 1):
        assert ethiopian_to_gregorian(*gregorian_to_ethiopian(day)) == day
        day += timedelta(days=1)


def test_pagume_6_only_in_leap_year():
    with pytest.raises(EthiopianDateError):
        ethiopian_to_gregorian(2016, 13, 6)


@pytest.mark.parametrize("bad", ["2017-14-01", "2017-01-31", "not-a-date", ""])
def test_invalid_input(bad):
    with pytest.raises(EthiopianDateError):
        parse_ethiopian_date(bad)


def test_parse_and_format():
    assert parse_ethiopian_date("2017/01/01") == date(2024, 9, 11)
    assert format_ethiopian_date(date(2024, 9, 11)) == "2017-01-01"

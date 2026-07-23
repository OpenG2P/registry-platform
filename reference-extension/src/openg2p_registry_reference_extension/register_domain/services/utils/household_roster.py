from dataclasses import dataclass
from datetime import date

from openg2p_registry_core.models import GenderEnum, RecordStatusEnum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .validations import as_int, parse_date

CHILDREN_U5_MAX_AGE = 4
SCHOOL_AGE_MIN = 5
SCHOOL_AGE_MAX = 17
ADULT_MIN = 18
ADULT_MAX = 59
ELDERLY_MIN = 60

ROSTER_AFFECTING_FIELDS = frozenset(
    {
        "link_internal_record_id",
        "record_status",
        "birth_date",
        "estimated_age",
        "gender",
        "residency_status",
    }
)


@dataclass(frozen=True)
class HouseholdRosterAggregates:
    size_total: int
    size_adults: int
    size_children_u5: int
    size_school_age: int
    size_elderly: int
    number_of_female_members: int
    number_of_male_members: int
    elderly_member_present: bool


def normalize_link(value) -> str | None:
    if value is None or value == "":
        return None
    normalized = str(value).strip()
    return normalized or None


def has_roster_affecting_changes(change_payload: dict) -> bool:
    return any(key in change_payload for key in ROSTER_AFFECTING_FIELDS)


def member_payload(individual, change_payload: dict) -> dict:
    base = individual.to_dict()
    overlay = {
        key: value
        for key, value in change_payload.items()
        if key in ROSTER_AFFECTING_FIELDS or key == "internal_record_id"
    }
    return {**base, **overlay}


def affected_household_ids(old_link: str | None, new_link: str | None) -> set[str]:
    household_ids: set[str] = set()
    if old_link:
        household_ids.add(old_link)
    if new_link:
        household_ids.add(new_link)
    return household_ids


def calculate_age(birth_date: date, today: date | None = None) -> int | None:
    if not birth_date:
        return None
    today = today or date.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


def resolve_member_age(member: dict, today: date | None = None) -> int | None:
    birth_date = parse_date(member.get("birth_date"))
    if birth_date is not None:
        return calculate_age(birth_date, today)
    return as_int(member.get("estimated_age"))


def is_active_member(member: dict) -> bool:
    record_status = member.get("record_status") or RecordStatusEnum.ACTIVE.value
    return record_status == RecordStatusEnum.ACTIVE.value


def compute_household_roster_counts(
    members: list[dict],
    today: date | None = None,
) -> HouseholdRosterAggregates:
    size_total = 0
    size_children_u5 = 0
    size_school_age = 0
    size_adults = 0
    size_elderly = 0
    number_of_male_members = 0
    number_of_female_members = 0

    for member in members:
        if not is_active_member(member):
            continue

        size_total += 1
        age = resolve_member_age(member, today)
        if age is not None:
            if age <= CHILDREN_U5_MAX_AGE:
                size_children_u5 += 1
            elif SCHOOL_AGE_MIN <= age <= SCHOOL_AGE_MAX:
                size_school_age += 1
            elif ADULT_MIN <= age <= ADULT_MAX:
                size_adults += 1
            elif age >= ELDERLY_MIN:
                size_elderly += 1

        gender = member.get("gender")
        if gender == GenderEnum.MALE.value:
            number_of_male_members += 1
        elif gender == GenderEnum.FEMALE.value:
            number_of_female_members += 1

    return HouseholdRosterAggregates(
        size_total=size_total,
        size_adults=size_adults,
        size_children_u5=size_children_u5,
        size_school_age=size_school_age,
        size_elderly=size_elderly,
        number_of_female_members=number_of_female_members,
        number_of_male_members=number_of_male_members,
        elderly_member_present=size_elderly > 0,
    )


def apply_household_roster_counts(household, aggregates: HouseholdRosterAggregates) -> None:
    household.size_total = aggregates.size_total
    household.size_adults = aggregates.size_adults
    household.size_children_u5 = aggregates.size_children_u5
    household.size_school_age = aggregates.size_school_age
    household.size_elderly = aggregates.size_elderly
    household.number_of_female_members = aggregates.number_of_female_members
    household.number_of_male_members = aggregates.number_of_male_members
    household.elderly_member_present = aggregates.elderly_member_present


async def recompute_household_roster_for_household(
    session: AsyncSession,
    household_internal_record_id: str,
    *,
    changed_member_id: str | None = None,
    changed_member_payload: dict | None = None,
) -> None:
    from ...models.household import G2PRegisterHousehold
    from ...models.individual import G2PRegisterIndividual

    household = await session.get(G2PRegisterHousehold, household_internal_record_id)
    if not household:
        return

    members_result = await session.execute(
        select(G2PRegisterIndividual).where(
            G2PRegisterIndividual.link_internal_record_id == household_internal_record_id
        )
    )
    members_by_id = {
        member.internal_record_id: member.to_dict()
        for member in members_result.scalars().all()
    }

    if changed_member_id and changed_member_payload is not None:
        effective_link = normalize_link(changed_member_payload.get("link_internal_record_id"))
        if (
            effective_link == household_internal_record_id
            and is_active_member(changed_member_payload)
        ):
            members_by_id[changed_member_id] = changed_member_payload
        elif changed_member_id in members_by_id:
            del members_by_id[changed_member_id]

    aggregates = compute_household_roster_counts(list(members_by_id.values()))
    apply_household_roster_counts(household, aggregates)

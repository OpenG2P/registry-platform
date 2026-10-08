"""Paged partner search over one register, plus a bulk load of its tree."""

from __future__ import annotations

from openg2p_fastapi_common.context import get_async_session_maker
from sqlalchemy import func, select

from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException
from openg2p_registry_core.models import G2PRegisterDefinition

from .compile import compile_search
from .hierarchy import load_related, resolve_model
from .query import RegisterSearch, RegisterSearchPage


class PartnerRegisterSearch:
    """Execute partner searches without the staff per-row hierarchy walk.

    Filters apply only to ``RegisterSearch.register_mnemonic``. Matching rows
    are paged, then each related register is loaded with one ``IN`` query and
    stitched into the nested dict the outbound template already reads.
    """

    def __init__(self, allowed_columns: set[str]):
        self.allowed_columns = set(allowed_columns)

    async def search_batch(self, searches: list[RegisterSearch]) -> list[RegisterSearchPage]:
        if not searches:
            return []

        session_maker = get_async_session_maker()
        async with session_maker() as session:
            definitions = (
                await session.execute(select(G2PRegisterDefinition))
            ).scalars().all()
            by_mnemonic = {definition.register_mnemonic: definition for definition in definitions}
            models: dict[str, type] = {}
            pages: list[RegisterSearchPage] = []
            for search in searches:
                pages.append(
                    await self._search_one(session, search, by_mnemonic, definitions, models)
                )
            return pages

    async def _search_one(self, session, search: RegisterSearch, by_mnemonic, definitions, models) -> RegisterSearchPage:
        definition = by_mnemonic.get(search.register_mnemonic)
        if definition is None:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.REGISTER_NOT_FOUND.value[1],
                message=f"Register '{search.register_mnemonic}' was not found.",
            )
        model = models.get(definition.register_id)
        if model is None:
            model = resolve_model(definition)
            models[definition.register_id] = model

        if search.page < 1 or search.page_size < 1:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.INVALID_REQUEST.value[1],
                message="Pagination page and page_size must be at least 1.",
            )

        conditions, order_by = compile_search(model, search, self.allowed_columns)
        total = (
            await session.execute(
                select(func.count()).select_from(model).where(*conditions)
            )
        ).scalar_one()
        query = select(model).where(*conditions)
        if order_by:
            query = query.order_by(*order_by)
        offset = (search.page - 1) * search.page_size
        rows = (
            await session.execute(query.offset(offset).limit(search.page_size))
        ).scalars().all()
        records = await load_related(session, definition, rows, definitions)
        return RegisterSearchPage(
            records=records,
            total_count=int(total or 0),
            page=search.page,
            page_size=search.page_size,
        )

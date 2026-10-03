import logging
import asyncio
from functools import lru_cache
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker
from openg2p_fastapi_common.service import BaseService
from fastapi_cache.decorator import cache

from ..engine import get_engines
from ..helpers.master_data_client import master_data_read_mode
from ..config import Settings

_logger = logging.getLogger('g2p-geo-hierarchy-service')
_config = Settings.get_config(strict=False)


class G2PGeoHierarchyService(BaseService):
    """
    Service for fetching and caching geo hierarchy data from Master Data.

    Read through MDS's catalogue API (master_data_read_mode = "api", the
    default: ``get_geo_unit`` with its ancestors, cached by geography version)
    or, as a rollback, from MDS's current-state tables ("db"):
    - g2p_geo_levels: Defines the hierarchy levels (e.g., state, district, taluk)
    - g2p_geo_level_values: Contains actual values with parent references
    """

    @cache(expire=_config.cache_expires_in_seconds)
    async def get_geo_hierarchy(self, level_value_id: str) -> Optional[dict]:
        """
        Get the full geo hierarchy for a given geo_lowest_level_value_id.
        
        Traverses up the parent chain from the lowest level to the root,
        building a hierarchy JSON with level and value information.
        
        Args:
            level_value_id: The ID of the lowest level geo value
            
        Returns:
            Dict with hierarchy array from top level to lowest level, or None if not found
            Example:
            {
                "hierarchy": [
                    {"level_mnemonic": "state", "level_value_mnemonic": "karnataka"},
                    {"level_mnemonic": "district", "level_value_mnemonic": "bangalore"},
                    {"level_mnemonic": "taluk", "level_value_mnemonic": "anekal"}
                ]
            }
        """
        if not level_value_id:
            return None
        if master_data_read_mode() == "api":
            return await self._hierarchy_from_api(level_value_id)
        return await self._hierarchy_from_db(level_value_id)

    @staticmethod
    async def _hierarchy_from_api(level_value_id: str) -> Optional[dict]:
        """The unit's chain from MDS's catalogue API, at the geography version in effect.

        Only a unit in use (ACTIVE, as are its ancestors) is found — the same as the
        current-state tables the db mode reads, which hold no retired units: this
        is filled when a record's location is set, i.e. for new data.
        """
        from ..helpers.master_data_client import get_master_data_client

        chain = await get_master_data_client().geo_unit(level_value_id)
        if chain is None or not chain.active:
            _logger.warning(f"Geo level value not found: {level_value_id}")
            return None
        return {
            "hierarchy": [
                {
                    "level_mnemonic": unit.level_mnemonic,
                    "level_value_mnemonic": unit.name,
                    "level_value_id": unit.unit_id,
                }
                for unit in chain.units
            ]
        }

    @staticmethod
    async def _hierarchy_from_db(level_value_id: str) -> Optional[dict]:
        master_data_engine = get_engines().get("db_engine_master_data")
        if not master_data_engine:
            _logger.warning("master-data-db engine not configured")
            return None
            
        session_maker = async_sessionmaker(master_data_engine, expire_on_commit=False)
        
        async with session_maker() as session:
            hierarchy = []
            current_value_id = level_value_id
            
            # Traverse up the hierarchy tree
            while current_value_id:
                # Query to get level value and its level info
                query = text("""
                    SELECT 
                        lv.level_value_id,
                        lv.level_value_mnemonic,
                        lv.parent_level_value_id,
                        l.level_mnemonic
                    FROM g2p_geo_level_values lv
                    JOIN g2p_geo_levels l ON lv.level_id = l.level_id
                    WHERE lv.level_value_id = :value_id
                """)
                
                result = await session.execute(query, {"value_id": current_value_id})
                row = result.fetchone()
                
                if not row:
                    if not hierarchy:
                        # Starting value not found
                        _logger.warning(f"Geo level value not found: {level_value_id}")
                        return None
                    break
                
                hierarchy.append({
                    "level_mnemonic": row.level_mnemonic,
                    "level_value_mnemonic": row.level_value_mnemonic,
                    "level_value_id": row.level_value_id
                })
                
                current_value_id = row.parent_level_value_id
            
            # Reverse to get top-level first
            hierarchy.reverse()
            
            return {"hierarchy": hierarchy}

    def get_geo_hierarchy_sync(self, level_value_id: str) -> Optional[dict]:
        """
        Synchronous wrapper for get_geo_hierarchy.
        
        Uses an internal LRU cache and runs the async method in a new event loop
        if needed. This is designed to be called from SQLAlchemy @validates decorators.
        
        Args:
            level_value_id: The ID of the lowest level geo value
            
        Returns:
            Dict with hierarchy array, or None if not found
        """
        return self._get_geo_hierarchy_cached(level_value_id)
    
    @lru_cache(maxsize=1000)
    def _get_geo_hierarchy_cached(self, level_value_id: str) -> Optional[dict]:
        """
        LRU cached synchronous implementation.
        """
        if not level_value_id:
            return None
            
        try:
            # Try to get the current event loop
            try:
                loop = asyncio.get_running_loop()
                # If we're already in an async context, we can't use run_until_complete
                # Create a new thread to run the coroutine
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.get_geo_hierarchy(level_value_id))
                    return future.result(timeout=30)
            except RuntimeError:
                # No running loop, we can create one
                return asyncio.run(self.get_geo_hierarchy(level_value_id))
        except Exception as e:
            _logger.error(f"Error fetching geo hierarchy for {level_value_id}: {e}")
            return None

    def clear_sync_cache(self):
        """Clear the synchronous LRU cache."""
        self._get_geo_hierarchy_cached.cache_clear()

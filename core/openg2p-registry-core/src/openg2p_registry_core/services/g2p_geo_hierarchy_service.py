import logging
import asyncio
from functools import lru_cache
from typing import Optional

from openg2p_fastapi_common.service import BaseService

_logger = logging.getLogger("g2p-geo-hierarchy-service")


class G2PGeoHierarchyService(BaseService):
    """Fetch and cache geo hierarchy from the Master Data API."""

    async def get_geo_hierarchy(self, level_value_id: str) -> Optional[dict]:
        """
        Get the full geo hierarchy for a given geo_lowest_level_value_id.

        Walks the parent chain from the lowest level to the root using the
        cached Master Data geo lists.

        Returns:
            Dict with hierarchy array from top level to lowest level, or None
            if not found. Example:
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

        from ..helpers.master_data import MasterDataClient

        client = MasterDataClient.get_component()
        if client is None:
            client = MasterDataClient()
        if not client.is_configured():
            _logger.warning("Master Data API URL is not configured")
            return None
        return await client.get_geo_hierarchy(level_value_id)

    def get_geo_hierarchy_sync(self, level_value_id: str) -> Optional[dict]:
        """
        Synchronous wrapper for get_geo_hierarchy.

        Uses an internal LRU cache and runs the async method in a new event loop
        if needed. This is designed to be called from SQLAlchemy @validates decorators.
        """
        return self._get_geo_hierarchy_cached(level_value_id)

    @lru_cache(maxsize=1000)
    def _get_geo_hierarchy_cached(self, level_value_id: str) -> Optional[dict]:
        if not level_value_id:
            return None

        try:
            try:
                asyncio.get_running_loop()
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.get_geo_hierarchy(level_value_id))
                    return future.result(timeout=30)
            except RuntimeError:
                return asyncio.run(self.get_geo_hierarchy(level_value_id))
        except Exception as e:
            _logger.error("Error fetching geo hierarchy for %s: %s", level_value_id, e)
            return None

    def clear_sync_cache(self):
        """Clear the synchronous LRU cache."""
        self._get_geo_hierarchy_cached.cache_clear()

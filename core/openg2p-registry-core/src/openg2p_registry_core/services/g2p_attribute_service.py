import logging
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.context import dbengine
from fastapi_cache.decorator import cache

from ..models import G2PAttributeValue
from ..schemas import G2PAttributeValueData
from ..config import Settings

_logger = logging.getLogger('g2p-attribute-service')
_config = Settings.get_config()


class G2PAttributeService(BaseService):
    @cache(expire=_config.cache_expires_in_seconds)
    async def get_attribute_values(
        self,
        attribute_id: str,
        parent_value_id: Optional[str] = None,
    ) -> List[G2PAttributeValueData]:
        """
        Get attribute values for a given attribute_id.
        If parent_value_id is provided, returns only values with that parent.
        If parent_value_id is None, returns all values for the attribute (top-level if hierarchical).
        
        Args:
            attribute_id: The attribute ID to get values for
            parent_value_id: Optional parent value ID to filter by
            
        Returns:
            List of G2PAttributeValueData sorted by sort_order
        """
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        
        async with session_maker() as session:
            # Build query
            query = select(G2PAttributeValue).where(
                G2PAttributeValue.attribute_id == attribute_id
            )
            
            # Filter by parent_value_id if provided
            if parent_value_id:
                query = query.where(G2PAttributeValue.parent_value_id == parent_value_id)
            
            # Order by sort_order
            query = query.order_by(G2PAttributeValue.sort_order)
            
            # Execute query
            result = await session.execute(query)
            attribute_values = result.scalars().all()
            
            # Convert to response data
            return [
                G2PAttributeValueData(
                    value_id=value.value_id,
                    attribute_id=value.attribute_id,
                    value_code=value.value_code,
                    value_display=value.value_display,
                    parent_value_id=value.parent_value_id,
                    sort_order=value.sort_order,
                )
                for value in attribute_values
            ]


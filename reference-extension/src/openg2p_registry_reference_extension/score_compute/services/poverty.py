import logging
from typing import Any

from openg2p_registry_core.interfaces.g2p_score_compute_interface import (
    G2PScoreComputeInterface,
)

_logger = logging.getLogger(__name__)


class G2PScoreComputeServicePoverty(G2PScoreComputeInterface):
    """
    Weighted-sum poverty-style score on household attributes configured in
    `g2p_register_score_definitions` (e.g. `size_total`, `size_children_u5`).
    """

    @staticmethod
    def _to_number(value: Any) -> float:
        if value is None:
            return 0.0
        if hasattr(value, "value"):
            value = value.value
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    async def compute_score(
        self,
        link_internal_record_id: str,
        contributing_attribute_values: dict,
        score_config: dict,
    ) -> float:
        weights = score_config.get("weights") or {}
        if not isinstance(weights, dict):
            weights = {}

        score = 0.0
        for key, weight in weights.items():
            if key not in contributing_attribute_values:
                continue
            w = weight
            try:
                w = float(w)
            except (TypeError, ValueError):
                continue
            score += self._to_number(contributing_attribute_values.get(key)) * w

        _logger.info(
            "Computed POVERTY score %.4f for household %s (attributes=%s)",
            round(score, 4),
            link_internal_record_id,
            sorted(contributing_attribute_values.keys()),
        )
        return round(score, 4)

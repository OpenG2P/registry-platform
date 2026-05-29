from abc import ABC, abstractmethod


class G2PScoreComputeInterface(ABC):
    """
    Domain-specific score compute contract.
    Implementations live in `openg2p_registry_extensions.score_compute.services`.
    """

    @abstractmethod
    async def compute_score(
        self,
        internal_record_id: str,
        contributing_attribute_values: dict,
        score_config: dict,
    ) -> float:
        """
        Compute and return the score for the given record.

        Args:
            internal_record_id: UUID of the register record.
            contributing_attribute_values: Snapshot of attribute values
                that feed into this score (from the queue item).
            score_config: Implementation-specific configuration from
                G2PRegisterScoreDefinition.score_config.
        """


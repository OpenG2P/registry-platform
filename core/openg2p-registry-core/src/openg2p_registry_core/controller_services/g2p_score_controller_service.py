import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import Session

from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService

from ..schemas import (
    CreateScoreDefinitionRequest,
    CreateScoreDefinitionResponsePayload,
    GetScoreHistoryRequest,
    GetScoreHistoryResponsePayload,
    GetScoreDefinitionsRequest,
    GetScoreDefinitionsResponsePayload,
    GetScoresRequest,
    GetScoresResponsePayload,
    ScoreDefinitionData,
    UpdateScoreDefinitionRequest,
    UpdateScoreDefinitionResponsePayload,
)
from ..errors import G2PRegistryErrorCodes, G2PRegistryException

from ..services import G2PScoreComputeService

_logger = logging.getLogger("g2p-score-controller-service")


class G2PScoreControllerService(BaseService):
    async def get_scores_for_record(
        self, get_scores_request: GetScoresRequest
    ) -> GetScoresResponsePayload:
        _logger.info("Fetching scores for record through controller service")
        scores_request_payload = get_scores_request.request_body.request_payload
        link_internal_record_id: str = scores_request_payload.link_internal_record_id
        
        try:
            g2p_score_compute_service = G2PScoreComputeService.get_component()
            session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
            async with session_maker() as session:
                scores_data = await g2p_score_compute_service.get_scores_for_record(
                    link_internal_record_id=link_internal_record_id, session=session
                )
        except Exception as e:
            _logger.error(f"Error fetching scores for record {link_internal_record_id}: {str(e)}")
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.SCORE_COMPUTE_SERVICE_ERROR.value[1],
                message=f"Failed to fetch scores for record: {str(e)}"
            )

        return GetScoresResponsePayload(scores=scores_data)

    async def get_score_history(
        self, get_score_history_request: GetScoreHistoryRequest
    ) -> GetScoreHistoryResponsePayload:
        _logger.info("Getting score history through controller service")
        score_history_request_payload = get_score_history_request.request_body.request_payload
        link_internal_record_id: str = score_history_request_payload.link_internal_record_id
        score_type: str = score_history_request_payload.score_type

        g2p_score_compute_service = G2PScoreComputeService.get_component()
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            score_history_data = await g2p_score_compute_service.get_score_history(
                link_internal_record_id=link_internal_record_id,
                score_type=score_type,
                session=session,
            )

        return GetScoreHistoryResponsePayload(history=score_history_data)

    async def get_score_definitions(
        self, get_score_definitions_request: GetScoreDefinitionsRequest
    ) -> GetScoreDefinitionsResponsePayload:
        _logger.info("Getting score definitions through controller service")
        score_definitions_request_payload = get_score_definitions_request.request_body.request_payload
        register_id = score_definitions_request_payload.register_id

        g2p_score_compute_service = G2PScoreComputeService.get_component()
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            score_definitions_data = await g2p_score_compute_service.get_score_definitions_for_register(
                register_id=register_id, session=session
            )

        return GetScoreDefinitionsResponsePayload(score_definitions=score_definitions_data)

    async def create_score_definition(
        self, create_score_definition_request: CreateScoreDefinitionRequest
    ) -> CreateScoreDefinitionResponsePayload:
        _logger.info("Creating score definition through controller service")
        create_score_definition_payload = create_score_definition_request.request_body.request_payload

        g2p_score_compute_service = G2PScoreComputeService.get_component()
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            score_definition_data = await g2p_score_compute_service.create_score_definition(
                register_id=create_score_definition_payload.register_id,
                score_type=create_score_definition_payload.score_type,
                contributing_attributes=create_score_definition_payload.contributing_attributes,
                score_config=create_score_definition_payload.score_config,
                session=session,
            )
            await session.commit()

        return CreateScoreDefinitionResponsePayload(
            score_definition=score_definition_data
        )

    async def update_score_definition(
        self, update_score_definition_request: UpdateScoreDefinitionRequest
    ) -> UpdateScoreDefinitionResponsePayload:
        _logger.info("Updating score definition through controller service")
        update_score_definition_payload = update_score_definition_request.request_body.request_payload

        g2p_score_compute_service = G2PScoreComputeService.get_component()
        session_maker = async_sessionmaker(dbengine.get(), expire_on_commit=False)
        async with session_maker() as session:
            score_definition_data = await g2p_score_compute_service.update_score_definition(
                score_definition_id=update_score_definition_payload.score_definition_id,
                contributing_attributes=update_score_definition_payload.contributing_attributes,
                score_config=update_score_definition_payload.score_config,
                is_enabled=update_score_definition_payload.is_enabled,
                session=session,
            )
            await session.commit()

        return UpdateScoreDefinitionResponsePayload(
            score_definition=score_definition_data
        )


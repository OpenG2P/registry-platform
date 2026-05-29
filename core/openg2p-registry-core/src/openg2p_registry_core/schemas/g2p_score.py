from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field

from openg2p_fastapi_common.schemas import G2PRequest, G2PRequestBody, G2PResponse, G2PResponseBody


# =============================================================================
# Score Data Schemas
# =============================================================================


class GetScoresRequestPayload(BaseModel):
    """Payload for getting scores for a record."""
    link_internal_record_id: str = Field(..., description="Linked record internal record ID")


class ScoreData(BaseModel):
    """Individual score data."""
    score_type: str = Field(..., description="Type of score")
    computed_score: float = Field(..., description="Computed score value")
    computed_at: Optional[str] = Field(None, description="Timestamp when score was computed")
    triggered_by_cr_id: str = Field(..., description="Change request ID that triggered this computation")
    triggered_by_submission_id: Optional[str] = Field(
        None, description="Submission ID that triggered this computation (if any)"
    )


class GetScoresResponsePayload(BaseModel):
    """Response payload for getting scores."""
    scores: List[ScoreData] = Field(..., description="List of scores for the record")


# =============================================================================
# Score History Schemas
# =============================================================================


class GetScoreHistoryRequestPayload(BaseModel):
    """Payload for getting score history for a record."""
    link_internal_record_id: str = Field(..., description="Linked record internal record ID")
    score_type: str = Field(..., description="Type of score")


class ScoreHistoryData(BaseModel):
    """Historical score data."""
    computed_score: float = Field(..., description="Computed score value")
    computed_at: Optional[str] = Field(None, description="Timestamp when score was computed")
    triggered_by_cr_id: str = Field(..., description="Change request ID that triggered this computation")
    triggered_by_submission_id: Optional[str] = Field(
        None, description="Submission ID that triggered this computation (if any)"
    )


class GetScoreHistoryResponsePayload(BaseModel):
    """Response payload for getting score history."""
    history: List[ScoreHistoryData] = Field(..., description="List of historical scores")


class GetScoresRequestBody(G2PRequestBody):
    request_payload: GetScoresRequestPayload


class GetScoresRequest(G2PRequest):
    request_body: GetScoresRequestBody


# =============================================================================
# Score Definitions (metadata CRUD)
# =============================================================================


class ScoreDefinitionData(BaseModel):
    """Score definition metadata."""
    score_definition_id: str = Field(..., description="Score definition ID")
    score_type: str = Field(..., description="Type of score")
    contributing_attributes: List[str] = Field(..., description="List of contributing attribute paths")
    score_config: Optional[dict[str, Any]] = Field(None, description="Score configuration parameters")
    is_enabled: bool = Field(..., description="Whether the score definition is enabled")


class GetScoreDefinitionsRequestPayload(BaseModel):
    """Payload for getting score definitions for a register."""
    register_id: str = Field(..., description="Register ID")


class GetScoreDefinitionsResponsePayload(BaseModel):
    """Response payload for getting score definitions."""
    score_definitions: List[ScoreDefinitionData] = Field(..., description="List of score definitions")


class CreateScoreDefinitionRequestPayload(BaseModel):
    """Payload for creating a new score definition."""
    register_id: str = Field(..., description="Register ID")
    score_type: str = Field(..., description="Type of score")
    contributing_attributes: List[str] = Field(..., description="List of contributing attribute paths")
    score_config: Optional[dict[str, Any]] = Field(None, description="Score configuration parameters")


class CreateScoreDefinitionResponsePayload(BaseModel):
    """Response payload for creating a score definition."""
    score_definition: ScoreDefinitionData = Field(..., description="Created score definition")


class UpdateScoreDefinitionRequestPayload(BaseModel):
    """Payload for updating an existing score definition."""
    score_definition_id: str = Field(..., description="Score definition ID")
    contributing_attributes: Optional[List[str]] = Field(None, description="List of contributing attribute paths")
    score_config: Optional[dict[str, Any]] = Field(None, description="Score configuration parameters")
    is_enabled: Optional[bool] = Field(None, description="Whether the score definition is enabled")


class UpdateScoreDefinitionResponsePayload(BaseModel):
    """Response payload for updating a score definition."""
    score_definition: ScoreDefinitionData = Field(..., description="Updated score definition")


# =============================================================================
# Score Data Request Schemas
# =============================================================================


class GetScoresRequestBody(G2PRequestBody):
    request_payload: GetScoresRequestPayload


class GetScoresRequest(G2PRequest):
    request_body: GetScoresRequestBody


# =============================================================================
# Score History Request Schemas
# =============================================================================


class GetScoreHistoryRequestBody(G2PRequestBody):
    request_payload: GetScoreHistoryRequestPayload


class GetScoreHistoryRequest(G2PRequest):
    request_body: GetScoreHistoryRequestBody


# =============================================================================
# Score Definitions Request Schemas
# =============================================================================


class GetScoreDefinitionsRequestBody(G2PRequestBody):
    request_payload: GetScoreDefinitionsRequestPayload


class GetScoreDefinitionsRequest(G2PRequest):
    request_body: GetScoreDefinitionsRequestBody


class CreateScoreDefinitionRequestBody(G2PRequestBody):
    request_payload: CreateScoreDefinitionRequestPayload


class CreateScoreDefinitionRequest(G2PRequest):
    request_body: CreateScoreDefinitionRequestBody


class UpdateScoreDefinitionRequestBody(G2PRequestBody):
    request_payload: UpdateScoreDefinitionRequestPayload


class UpdateScoreDefinitionRequest(G2PRequest):
    request_body: UpdateScoreDefinitionRequestBody


# =============================================================================
# Response Wrappers (staff portal style)
# =============================================================================


class GetScoresResponseBody(G2PResponseBody):
    response_payload: Optional[GetScoresResponsePayload] = None


class GetScoresResponse(G2PResponse):
    response_body: Optional[GetScoresResponseBody] = None


class GetScoreHistoryResponseBody(G2PResponseBody):
    response_payload: Optional[GetScoreHistoryResponsePayload] = None


class GetScoreHistoryResponse(G2PResponse):
    response_body: Optional[GetScoreHistoryResponseBody] = None


class GetScoreDefinitionsResponseBody(G2PResponseBody):
    response_payload: Optional[GetScoreDefinitionsResponsePayload] = None


class GetScoreDefinitionsResponse(G2PResponse):
    response_body: Optional[GetScoreDefinitionsResponseBody] = None


class CreateScoreDefinitionResponseBody(G2PResponseBody):
    response_payload: Optional[CreateScoreDefinitionResponsePayload] = None


class CreateScoreDefinitionResponse(G2PResponse):
    response_body: Optional[CreateScoreDefinitionResponseBody] = None


class UpdateScoreDefinitionResponseBody(G2PResponseBody):
    response_payload: Optional[UpdateScoreDefinitionResponsePayload] = None


class UpdateScoreDefinitionResponse(G2PResponse):
    response_body: Optional[UpdateScoreDefinitionResponseBody] = None


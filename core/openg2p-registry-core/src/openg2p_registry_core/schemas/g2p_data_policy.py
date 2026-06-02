from enum import StrEnum
from typing import Annotated, Any, List, Literal, Optional, Union

from pydantic import BaseModel, Field, model_validator
from openg2p_fastapi_common.schemas import (
    G2PRequest,
    G2PRequestBody,
    G2PResponse,
    G2PResponseBody,
)

from .register_payload import FilterOperator

_LEGACY_POLICY_OPERATOR_TO_FILTER = {
    "EQ": "eq",
    "NEQ": "neq",
    "IN": "in",
    "NIN": "nin",
    "GT": "gt",
    "GTE": "gte",
    "LT": "lt",
    "LTE": "lte",
    "BETWEEN": "between",
    "CONTAINS": "contains",
    "NCONTAINS": "ncontains",
    "STARTSWITH": "startsWith",
    "ENDSWITH": "endsWith",
    "ISNULL": "isNull",
}


class RegistryDataPolicyType(StrEnum):
    ALLOW = "ALLOW"
    DISALLOW = "DISALLOW"


class PolicyGroupOperator(StrEnum):
    AND = "AND"
    OR = "OR"
    NOT = "NOT"


class PolicyFilterCondition(BaseModel):
    type: Literal["CONDITION"] = "CONDITION"
    field_id: str = Field(..., description="Register field to filter on")
    operator: FilterOperator = Field(
        ...,
        description="Same operators as register search filter_by (eq, in, contains, ...)",
    )
    value: Optional[Any] = Field(None, description="Single comparison value")
    values: Optional[List[Any]] = Field(None, description="List value for in/nin operators")

    @model_validator(mode="before")
    @classmethod
    def _normalize_operator(cls, data: Any) -> Any:
        if isinstance(data, dict) and isinstance(data.get("operator"), str):
            raw = data["operator"]
            normalized = _LEGACY_POLICY_OPERATOR_TO_FILTER.get(raw.upper(), raw)
            data = {**data, "operator": normalized}
        return data


class PolicyFilterGroup(BaseModel):
    type: Literal["GROUP"] = "GROUP"
    operator: PolicyGroupOperator = Field(..., description="Logical operator for children")
    children: List["PolicyFilterChild"] = Field(
        default_factory=list,
        description="Nested filter nodes",
    )


PolicyFilterChild = Annotated[
    Union[PolicyFilterCondition, PolicyFilterGroup],
    Field(discriminator="type"),
]

PolicyFilterGroup.model_rebuild()
PolicyFilterExpression = Union[PolicyFilterGroup, PolicyFilterCondition]


class RegistryDataPolicyData(BaseModel):
    policy_id: str = Field(..., description="Policy ID")
    policy_mnemonic: str = Field(..., description="Unique mnemonic; referenced from Keycloak roles")
    policy_description: Optional[str] = Field(None, description="Human-readable description")
    register_id: str = Field(..., description="Register definition ID")
    policy_type: RegistryDataPolicyType = Field(..., description="ALLOW or DISALLOW")
    policy_filter_expression: dict = Field(
        ...,
        description="Nested GROUP/CONDITION policy filter tree",
    )


class GetPoliciesRequestPayload(BaseModel):
    register_id: str = Field(..., description="Register definition ID")


class GetPoliciesResponsePayload(BaseModel):
    policies: List[RegistryDataPolicyData] = Field(default_factory=list)


class AddPolicyRequestPayload(BaseModel):
    policy_mnemonic: str = Field(..., description="Unique mnemonic within the register")
    policy_description: Optional[str] = Field(None, description="Human-readable description")
    register_id: str = Field(..., description="Register definition ID")
    policy_type: RegistryDataPolicyType = Field(..., description="ALLOW or DISALLOW")
    policy_filter_expression: dict = Field(
        ...,
        description="Nested GROUP/CONDITION policy filter tree",
    )


class AddPolicyResponsePayload(BaseModel):
    policy: RegistryDataPolicyData = Field(..., description="Created policy")


class RemovePolicyRequestPayload(BaseModel):
    policy_id: str = Field(..., description="Policy ID to remove")


class RemovePolicyResponsePayload(BaseModel):
    policy_id: str = Field(..., description="Removed policy ID")


class GetPoliciesRequestBody(G2PRequestBody):
    request_payload: GetPoliciesRequestPayload


class GetPoliciesRequest(G2PRequest):
    request_body: GetPoliciesRequestBody


class AddPolicyRequestBody(G2PRequestBody):
    request_payload: AddPolicyRequestPayload


class AddPolicyRequest(G2PRequest):
    request_body: AddPolicyRequestBody


class RemovePolicyRequestBody(G2PRequestBody):
    request_payload: RemovePolicyRequestPayload


class RemovePolicyRequest(G2PRequest):
    request_body: RemovePolicyRequestBody


class GetPoliciesResponseBody(G2PResponseBody):
    response_payload: Optional[GetPoliciesResponsePayload] = None


class GetPoliciesResponse(G2PResponse):
    response_body: Optional[GetPoliciesResponseBody] = None


class AddPolicyResponseBody(G2PResponseBody):
    response_payload: Optional[AddPolicyResponsePayload] = None


class AddPolicyResponse(G2PResponse):
    response_body: Optional[AddPolicyResponseBody] = None


class RemovePolicyResponseBody(G2PResponseBody):
    response_payload: Optional[RemovePolicyResponsePayload] = None


class RemovePolicyResponse(G2PResponse):
    response_body: Optional[RemovePolicyResponseBody] = None

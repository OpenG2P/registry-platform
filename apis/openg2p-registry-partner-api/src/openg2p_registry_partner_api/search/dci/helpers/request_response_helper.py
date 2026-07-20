import uuid
from fastapi import Request
from typing import Dict
from datetime import datetime
from openg2p_fastapi_common.service import BaseService
from openg2p_fastapi_common.schemas import G2PResponse, G2PResponseHeader, G2PResponseStatus, G2PResponseBody
from openg2p_registry_core.schemas import IngestDataPayload, IngestDataRequest, IngestDataResponse, IngestDataResponseBody
from openg2p_registry_core.errors import G2PRegistryErrorCodes, G2PRegistryException

from ..schemas import (
    DciSearchRequestEnvelope, 
    DciSearchResponseEnvelope, 
    DciSearchResponseItem, 
    DciResponseHeader, 
    DciStatusCode, 
    DciSearchResponse
)

class DciRequestResponseHelper(BaseService):

    def construct_dci_search_success_response(self, dci_search_response_items: list[DciSearchResponseItem], dci_search_request_env: DciSearchRequestEnvelope) -> DciSearchResponseEnvelope:
        dci_message_header = DciResponseHeader(
            version="1.0.0",
            message_id=dci_search_request_env.header.message_id,
            message_ts=dci_search_request_env.header.message_ts,
            action="search",
            sender_id=dci_search_request_env.header.receiver_id,
            receiver_id=dci_search_request_env.header.sender_id,
            sender_uri=dci_search_request_env.header.sender_uri,
            status=DciStatusCode.SUCCESS.value,
            total_count=len(dci_search_request_env.message.search_request),
            completed_count=len(dci_search_response_items),
            is_msg_encrypted=False,
            meta={}
        )
        dci_search_response = DciSearchResponse(
            transaction_id=dci_search_request_env.message.transaction_id,
            correlation_id=uuid.uuid4().hex,
            search_response=dci_search_response_items
        )

        dci_search_response_env: DciSearchResponseEnvelope = DciSearchResponseEnvelope(
            signature="",
            header=dci_message_header,
            message=dci_search_response
        )
        return dci_search_response_env
    
    def construct_error_response(self, error: Exception, dci_search_request_env: DciSearchRequestEnvelope = None) -> DciSearchResponseEnvelope:
        """
        Unified error response constructor that handles both G2PRegistryException and generic exceptions.
        For G2PRegistryException, uses the exception's code and message.
        For other exceptions, returns a generic internal error (full details are logged only).
        g2p_request is optional - if not provided, request_id will be empty string.
        """
        if isinstance(error, G2PRegistryException):
            error_code = error.code
            error_message = error.message
        else:
            error_code = G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1]
            error_message = G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[0]

        dci_message_header = DciResponseHeader(
            version="1.0.0",
            message_id=dci_search_request_env.header.message_id,
            message_ts=dci_search_request_env.header.message_ts,
            action="search",
            sender_id=dci_search_request_env.header.receiver_id,
            receiver_id=dci_search_request_env.header.sender_id,
            sender_uri=dci_search_request_env.header.sender_uri,
            status=DciStatusCode.REJECTED.value,
            status_reason_code=error_code,
            status_reason_message=error_message,
            total_count=len(dci_search_request_env.message.search_request),
            completed_count=0,
            is_msg_encrypted=False,
            meta={}
        )
        dci_search_response = DciSearchResponse(
            transaction_id=dci_search_request_env.message.transaction_id,
            correlation_id=uuid.uuid4().hex,
            search_response=[]
        )

        dci_search_response_env: DciSearchResponseEnvelope = DciSearchResponseEnvelope(
            signature="",
            header=dci_message_header,
            message=dci_search_response
        )
        return dci_search_response_env

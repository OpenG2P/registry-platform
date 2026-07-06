import logging
from datetime import datetime

from fastapi import Query
from openg2p_fastapi_common.controller import BaseController
from iam_core.user_auth.decorators import require_permissions

from openg2p_registry_core.controller_services import (
    G2PRegistrantAuthenticationControllerService,
)
from openg2p_registry_core.schemas import (
    RegistrantAuthProvidersRequest,
    RegistrantAuthProvidersResponse,
    RegistrantAuthInitiateRequest,
    RegistrantAuthInitiateResponse,
    RegistrantAuthStatusRequest,
    RegistrantAuthStatusResponse,
    RegistrantAuthHistoryRequest,
    RegistrantAuthHistoryResponse,
    RegistrantAuthCallbackCompleteRequest,
)

from ..config import Settings
from ..helpers import RequestResponseHelper

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)


class G2PRegistrantAuthenticationController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.router.tags += ["/register-data"]
        self.router.prefix = ""
        self.registrant_authentication_service = G2PRegistrantAuthenticationControllerService.get_component()
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/register-data/get_available_authentication_providers",
            self.get_available_providers,
            responses={200: {"model": RegistrantAuthProvidersResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/register-data/authenticate_registrant",
            self.initiate_authentication,
            responses={200: {"model": RegistrantAuthInitiateResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/registrant-auth/callback",
            self.callback,
            methods=["GET"],
        )

        self.router.add_api_route(
            "/register-data/get_registrant_authentication_status",
            self.get_status,
            responses={200: {"model": RegistrantAuthStatusResponse}},
            methods=["POST"],
        )

        self.router.add_api_route(
            "/register-data/get_registrant_authentication_history",
            self.get_history,
            responses={200: {"model": RegistrantAuthHistoryResponse}},
            methods=["POST"],
        )

    @require_permissions({"register:authenticate"})
    async def get_available_providers(
        self, request: RegistrantAuthProvidersRequest
    ) -> RegistrantAuthProvidersResponse:
        try:
            payload = await self.registrant_authentication_service.get_available_providers(request)
            return self.helper.construct_registrant_auth_providers_success_response(
                response_payload=payload, g2p_request=request
            )
        except Exception as e:
            _logger.error("Error in get_available_providers: %s", str(e))
            return self.helper.construct_error_response(e, request)

    @require_permissions({"register:authenticate"})
    async def initiate_authentication(
        self, request: RegistrantAuthInitiateRequest
    ) -> RegistrantAuthInitiateResponse:
        try:
            payload = await self.registrant_authentication_service.initiate_authentication(request)
            return self.helper.construct_registrant_auth_initiate_success_response(
                response_payload=payload, g2p_request=request
            )
        except Exception as e:
            _logger.error("Error in initiate_authentication: %s", str(e))
            return self.helper.construct_error_response(e, request)

    async def callback(
        self,
        code: str = Query(...),
        state: str = Query(...),
    ):
        # OAuth callback: Return HTML page with authentication result, fallback to JSON
        try:
            result = await self.registrant_authentication_service.complete_callback(
                RegistrantAuthCallbackCompleteRequest(code=code, state=state)
            )
            
            # Try to generate HTML response
            try:
                html_content = self._generate_auth_result_html(result)
                from fastapi.responses import HTMLResponse
                return HTMLResponse(content=html_content)
            except Exception as html_error:
                # Fallback to JSON if HTML rendering fails
                _logger.warning(f"HTML rendering failed, falling back to JSON: {html_error}")
                return result
            
        except Exception as e:
            # Return error page, fallback to JSON if HTML fails
            try:
                html_content = self._generate_error_html(str(e))
                from fastapi.responses import HTMLResponse
                return HTMLResponse(content=html_content)
            except Exception as html_error:
                # Fallback to JSON error response
                _logger.warning(f"HTML error rendering failed, falling back to JSON: {html_error}")
                return {
                    "authentication_id": None,
                    "status": "FAILED",
                    "failure_reason": str(e)
                }

    @require_permissions({"register:authenticate"})
    async def get_status(
        self, request: RegistrantAuthStatusRequest
    ) -> RegistrantAuthStatusResponse:
        try:
            payload = await self.registrant_authentication_service.get_status(request)
            return self.helper.construct_registrant_auth_status_success_response(
                response_payload=payload, g2p_request=request
            )
        except Exception as e:
            _logger.error("Error in get_status: %s", str(e))
            return self.helper.construct_error_response(e, request)

    @require_permissions({"register:authenticate"})
    async def get_history(
        self, request: RegistrantAuthHistoryRequest
    ) -> RegistrantAuthHistoryResponse:
        try:
            payload = await self.registrant_authentication_service.get_history(request)
            return self.helper.construct_registrant_auth_history_success_response(
                response_payload=payload, g2p_request=request
            )
        except Exception as e:
            _logger.error("Error in get_history: %s", str(e))
            return self.helper.construct_error_response(e, request)

    def _generate_auth_result_html(self, result: dict) -> str:
        """Generate HTML page for authentication result"""
        auth_id = result.get("authentication_id", "N/A")
        status = result.get("status", "unknown")
        error_message = result.get("failure_reason", "")
        
        # Determine status color and icon
        if status == "SUCCESS":
            status_color = "#28a745"
            status_icon = "🔐"
            status_text = "Authentication Successful"
        elif status == "FAILURE":
            status_color = "#dc3545"
            status_icon = "🔒"
            status_text = "Authentication Failed"
        else:
            status_color = "#6c757d"
            status_icon = "⏸️"
            status_text = "Authentication Status"
        
        html = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authentication Result</title>
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #ffffff;
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }}
                    .container {{
                        background: white;
                        border: 1px solid #e9ecef;
                        border-radius: 12px;
                        padding: 40px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                        max-width: 500px;
                        width: 90%;
                        text-align: center;
                    }}
                    .status-icon {{
                        font-size: 48px;
                        margin-bottom: 20px;
                    }}
                    .status-text {{
                        font-size: 24px;
                        font-weight: bold;
                        color: {status_color};
                        margin-bottom: 30px;
                    }}
                    .info-card {{
                        background: #ffffff;
                        border: 1px solid #e9ecef;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                        text-align: left;
                    }}
                    .info-row {{
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin: 10px 0;
                        padding: 8px 0;
                        border-bottom: 1px solid #e9ecef;
                    }}
                    .info-row:last-child {{
                        border-bottom: none;
                    }}
                    .info-label {{
                        font-weight: 600;
                        color: #495057;
                        flex: 1;
                    }}
                    .info-value {{
                        color: #212529;
                        font-family: 'Courier New', monospace;
                        text-align: right;
                        flex: 1;
                    }}
                    .error-message {{
                        background: #f8d7da;
                        color: #721c24;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                        border: 1px solid #f5c6cb;
                    }}
                    .close-btn {{
                        background: {status_color};
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-top: 20px;
                        transition: opacity 0.3s;
                    }}
                    .close-btn:hover {{
                        opacity: 0.8;
                    }}
                    .timestamp {{
                        color: #6c757d;
                        font-size: 12px;
                        margin-top: 20px;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="status-icon">{status_icon}</div>
                    <div class="status-text">{status_text}</div>
                    
                    <div class="info-card">
                        <div class="info-row">
                            <span class="info-label">Authentication ID:</span>
                            <span class="info-value">{auth_id}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Status:</span>
                            <span class="info-value">{status}</span>
                        </div>
                        {f'<div class="info-row"><span class="info-label">Failure Message:</span><span class="info-value">{error_message}</span></div>' if status == "FAILURE" and error_message else ''}
                    </div>
                    
                    <button class="close-btn" onclick="window.close()">Close Window</button>
                    
                    <div class="timestamp">
                        Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                    </div>
                </div>
                
                <script>
                    // Auto-close after 10 seconds if successful
                    {'setTimeout(() => window.close(), 10000);' if status == 'SUCCESS' else ''}
                </script>
            </body>
            </html>
        """
        return html

    def _generate_error_html(self, error_message: str) -> str:
        """Generate HTML page for error"""
        html = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authentication Error</title>
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #ffffff;
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }}
                    .container {{
                        background: white;
                        border: 1px solid #e9ecef;
                        border-radius: 12px;
                        padding: 40px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                        max-width: 500px;
                        width: 90%;
                        text-align: center;
                    }}
                    .error-icon {{
                        font-size: 48px;
                        margin-bottom: 20px;
                    }}
                    .error-text {{
                        font-size: 24px;
                        font-weight: bold;
                        color: #dc3545;
                        margin-bottom: 30px;
                    }}
                    .error-message {{
                        background: #f8d7da;
                        color: #721c24;
                        padding: 20px;
                        border-radius: 6px;
                        margin: 20px 0;
                        border: 1px solid #f5c6cb;
                        text-align: left;
                    }}
                    .close-btn {{
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-top: 20px;
                    }}
                    .close-btn:hover {{
                        background: #c82333;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-icon">❌</div>
                    <div class="error-text">Authentication Error</div>
                    
                    <div class="error-message">
                        <strong>Error Details:</strong><br>
                        {error_message}
                    </div>
                    
                    <button class="close-btn" onclick="window.close()">Close Window</button>
                </div>
            </body>
            </html>
        """
        return html


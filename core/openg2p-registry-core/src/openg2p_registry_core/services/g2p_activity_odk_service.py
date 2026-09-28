"""Pull ODK Central form submissions into activity registers.

For each active ``g2p_activity_odk_forms`` row the service reads submissions
newer than its cursor through ODK Central's OData API, maps each one to an
activity with the configured ``mapping`` and appends it. The ODK instance ID is
the idempotency key, so re-reading a page never duplicates activities. A
submission that fails validation is kept in ``g2p_activity_odk_failures`` for
review and retried later; it does not hold back the cursor.
"""

import io
import logging
from datetime import datetime
from typing import Any, Optional

import httpx
from openg2p_fastapi_common.context import dbengine
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import async_sessionmaker

from ..config import Settings
from ..errors import G2PRegistryErrorCodes, G2PRegistryException
from ..models import (
    ActivityChannelEnum,
    DocumentBucket,
    G2PActivityOdkFailure,
    G2PActivityOdkForm,
    G2PRegisterDefinition,
    G2PRegistryDocument,
)
from ..schemas.activity import ActivityInput
from .g2p_activity_service import G2PActivityService

_config = Settings.get_config(strict=False)
_logger = logging.getLogger("g2p-activity-odk-service")

_ACTIVITY_FIELDS = (
    "activity_type",
    "occurred_at",
    "occurred_on_ec",
    "subject_type",
    "subject_id",
    "subject_internal_record_id",
    "context_key",
)


class OdkCentralClient:
    def __init__(self, base_url: str, username: str, password: str, timeout: float):
        self.base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._timeout = timeout
        self._token: Optional[str] = None

    async def _headers(self, client: httpx.AsyncClient) -> dict:
        if self._token is None:
            response = await client.post(
                f"{self.base_url}/v1/sessions", json={"email": self._username, "password": self._password}
            )
            response.raise_for_status()
            self._token = response.json()["token"]
        return {"Authorization": f"Bearer {self._token}"}

    async def submissions_since(self, project_id: int, form_id: str, since: Optional[str], top: int) -> list[dict]:
        params = {"$orderby": "__system/submissionDate asc", "$top": str(top), "$expand": "*"}
        if since:
            params["$filter"] = f"__system/submissionDate gt {since}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self.base_url}/v1/projects/{project_id}/forms/{form_id}.svc/Submissions",
                params=params,
                headers=await self._headers(client),
            )
            if response.status_code == 401:  # session expired
                self._token = None
                response = await client.get(
                    f"{self.base_url}/v1/projects/{project_id}/forms/{form_id}.svc/Submissions",
                    params=params,
                    headers=await self._headers(client),
                )
            response.raise_for_status()
            return response.json().get("value", [])

    async def attachment(self, project_id: int, form_id: str, instance_id: str, filename: str) -> tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self.base_url}/v1/projects/{project_id}/forms/{form_id}/submissions/{instance_id}"
                f"/attachments/{filename}",
                headers=await self._headers(client),
            )
            response.raise_for_status()
            return response.content, response.headers.get("content-type", "application/octet-stream")


def read_path(submission: dict, path: str) -> Any:
    value: Any = submission
    for part in [p for p in path.split("/") if p]:
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def transform(value: Any, name: Optional[str]) -> Any:
    if value is None or name is None:
        return value
    if name == "number":
        return float(value) if value != "" else None
    if name == "integer":
        return int(float(value)) if value != "" else None
    if name == "date":
        return str(value)[:10]
    if name == "boolean":
        return str(value).strip().lower() in ("1", "true", "yes", "y")
    if name == "split":
        return [part for part in str(value).split() if part]
    if name == "upper":
        return str(value).upper()
    if name in ("geopoint_lat", "geopoint_lon", "geopoint_alt"):
        lat, lon, alt = _geopoint(value)
        return {"geopoint_lat": lat, "geopoint_lon": lon, "geopoint_alt": alt}[name]
    return value


def _geopoint(value: Any) -> tuple[Optional[str], Optional[str], Optional[str]]:
    # ODK OData returns GeoJSON {"type": "Point", "coordinates": [lon, lat, alt]};
    # raw XML values are "lat lon alt accuracy".
    if isinstance(value, dict) and value.get("coordinates"):
        coordinates = value["coordinates"] + [None, None, None]
        return _s(coordinates[1]), _s(coordinates[0]), _s(coordinates[2])
    parts = str(value).split()
    parts += [None] * (3 - len(parts))
    return parts[0], parts[1], parts[2]


def _s(value) -> Optional[str]:
    return None if value is None else str(value)


class G2PActivityOdkService(BaseService):
    def __init__(self, name="", client: Optional[OdkCentralClient] = None):
        super().__init__(name)
        self.client = client or OdkCentralClient(
            _config.activity_odk_base_url,
            _config.activity_odk_username,
            _config.activity_odk_password,
            float(_config.activity_odk_timeout_seconds),
        )
        self.activities = G2PActivityService.get_component() or G2PActivityService()

    @staticmethod
    def _session_maker():
        return async_sessionmaker(dbengine.get(), expire_on_commit=False)

    async def pull_all(self) -> dict[str, dict]:
        async with self._session_maker()() as session:
            configs = list(
                (await session.execute(select(G2PActivityOdkForm).where(G2PActivityOdkForm.is_active.is_(True))))
                .scalars()
            )
        results = {}
        for config in configs:
            try:
                results[config.odk_form_id] = await self.pull_form(config.odk_form_config_id)
            except Exception as error:
                _logger.exception("ODK pull failed for %s", config.odk_form_id)
                await self._record_form_error(config.odk_form_config_id, str(error))
                results[config.odk_form_id] = {"error": str(error)}
        return results

    async def pull_form(self, config_id: str) -> dict[str, int]:
        page_size = int(_config.activity_odk_page_size)
        created = duplicates = failed = 0
        # One pull run is one submission batch.
        run_id = f"odk:{config_id}:{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}"
        while True:
            async with self._session_maker()() as session:
                config = await session.get(G2PActivityOdkForm, config_id)
                mnemonic = (await session.get(G2PRegisterDefinition, config.register_id)).register_mnemonic
            submissions = await self.client.submissions_since(
                config.odk_project_id, config.odk_form_id, config.last_submission_date, page_size
            )
            for submission in submissions:
                outcome = await self.ingest_submission(config, mnemonic, submission, run_id)
                created += outcome == "CREATED"
                duplicates += outcome == "DUPLICATE"
                failed += outcome == "FAILED"
            async with self._session_maker()() as session:
                async with session.begin():
                    config = await session.get(G2PActivityOdkForm, config_id, with_for_update=True)
                    if submissions:
                        config.last_submission_date = submissions[-1].get("__system", {}).get("submissionDate")
                    config.last_pulled_at = datetime.utcnow()
                    config.last_error = None
                    config.submissions_pulled += created + duplicates
                    config.submissions_failed += failed
            if len(submissions) < page_size:
                return {"created": created, "duplicates": duplicates, "failed": failed}

    async def retry_failures(self, config_id: str) -> dict[str, int]:
        async with self._session_maker()() as session:
            config = await session.get(G2PActivityOdkForm, config_id)
            mnemonic = (await session.get(G2PRegisterDefinition, config.register_id)).register_mnemonic
            failures = list(
                (
                    await session.execute(
                        select(G2PActivityOdkFailure).where(
                            G2PActivityOdkFailure.odk_form_config_id == config_id,
                            G2PActivityOdkFailure.resolved.is_(False),
                        )
                    )
                ).scalars()
            )
        fixed = 0
        for failure in failures:
            fixed += await self.ingest_submission(config, mnemonic, failure.submission or {}) != "FAILED"
        return {"retried": len(failures), "fixed": fixed}

    async def ingest_submission(self, config: G2PActivityOdkForm, mnemonic: str, submission: dict,
                                run_id: str | None = None) -> str:
        instance_id = submission.get("__id") or read_path(submission, "meta/instanceID")
        system = submission.get("__system") or {}
        if system.get("reviewState") == "rejected":
            return "SKIPPED"
        try:
            activity = await self.map_submission(config, mnemonic, submission, instance_id)
            if run_id:
                activity = activity.model_copy(update={"submission_id": run_id})
            _, outcome = await self.activities.append(
                activity, actor=system.get("submitterName") or "odk", channel=ActivityChannelEnum.ODK.value
            )
            await self._resolve_failure(config.odk_form_config_id, instance_id)
            return outcome
        except G2PRegistryException as error:
            await self._record_failure(config.odk_form_config_id, instance_id, submission, error.code, error.message)
        except Exception as error:
            _logger.exception("ODK submission %s failed", instance_id)
            await self._record_failure(
                config.odk_form_config_id, instance_id, submission,
                G2PRegistryErrorCodes.UNEXPECTED_ERROR.value[1], str(error),
            )
        return "FAILED"

    async def map_submission(
        self, config: G2PActivityOdkForm, mnemonic: str, submission: dict, instance_id: str
    ) -> ActivityInput:
        mapping = config.mapping or {}
        values: dict[str, Any] = {}
        for field in _ACTIVITY_FIELDS:
            if field in mapping:
                values[field] = await self._value(config, submission, instance_id, mapping[field])
        payload = {}
        for field, spec in (mapping.get("payload") or {}).items():
            value = await self._value(config, submission, instance_id, spec)
            if value not in (None, ""):
                payload[field] = value
        if not values.get("occurred_at") and not values.get("occurred_on_ec"):
            values["occurred_at"] = (submission.get("__system") or {}).get("submissionDate")
        try:
            return ActivityInput(
                register_mnemonic=mnemonic,
                payload=payload,
                source_record_id=instance_id,
                idempotency_key=f"odk:{config.odk_form_id}:{instance_id}",
                **{k: v for k, v in values.items() if v not in (None, "")},
            )
        except ValueError as error:
            raise G2PRegistryException(
                code=G2PRegistryErrorCodes.ACTIVITY_PAYLOAD_INVALID.value[1], message=str(error)
            )

    async def _value(self, config, submission: dict, instance_id: str, spec: Any) -> Any:
        if isinstance(spec, str):
            return read_path(submission, spec)
        if not isinstance(spec, dict):
            return spec
        if "value" in spec:
            return spec["value"]
        value = read_path(submission, spec.get("path", ""))
        if spec.get("transform") == "attachment":
            return await self._store_attachment(config, instance_id, value) if value else None
        return transform(value, spec.get("transform"))

    async def _store_attachment(self, config, instance_id: str, filename: str) -> str:
        """Download an attachment (e.g. a geo-tagged photo) into the documents bucket; return its document_id."""
        from ..helpers.document import get_document_handler

        content, content_type = await self.client.attachment(
            config.odk_project_id, config.odk_form_id, instance_id, filename
        )
        handler = get_document_handler()
        store_id = handler.upload(io.BytesIO(content), len(content), DocumentBucket.DOCUMENTS, content_type)
        async with self._session_maker()() as session:
            async with session.begin():
                document = G2PRegistryDocument(
                    document_store_id=store_id,
                    bucket=DocumentBucket.DOCUMENTS,
                    source_filename=filename,
                    created_by="odk",
                    created_at=datetime.utcnow(),
                )
                session.add(document)
                await session.flush()
                return document.document_id

    async def _record_failure(self, config_id, instance_id, submission, code, message) -> None:
        async with self._session_maker()() as session:
            async with session.begin():
                stmt = insert(G2PActivityOdkFailure).values(
                    odk_form_config_id=config_id,
                    instance_id=instance_id,
                    submission=submission,
                    error_code=code,
                    error_message=(message or "")[:4000],
                    attempts=1,
                    first_failed_at=datetime.utcnow(),
                    last_failed_at=datetime.utcnow(),
                    resolved=False,
                    failure_id=__import__("uuid").uuid4().hex,
                )
                await session.execute(
                    stmt.on_conflict_do_update(
                        constraint="uq_activity_odk_failure",
                        set_={
                            "submission": submission,
                            "error_code": code,
                            "error_message": (message or "")[:4000],
                            "attempts": G2PActivityOdkFailure.attempts + 1,
                            "last_failed_at": datetime.utcnow(),
                            "resolved": False,
                        },
                    )
                )

    async def _resolve_failure(self, config_id, instance_id) -> None:
        async with self._session_maker()() as session:
            async with session.begin():
                failure = (
                    await session.execute(
                        select(G2PActivityOdkFailure).where(
                            G2PActivityOdkFailure.odk_form_config_id == config_id,
                            G2PActivityOdkFailure.instance_id == instance_id,
                        )
                    )
                ).scalar()
                if failure is not None:
                    failure.resolved = True

    async def _record_form_error(self, config_id: str, message: str) -> None:
        async with self._session_maker()() as session:
            async with session.begin():
                config = await session.get(G2PActivityOdkForm, config_id)
                if config is not None:
                    config.last_error = message[:4000]
                    config.last_pulled_at = datetime.utcnow()

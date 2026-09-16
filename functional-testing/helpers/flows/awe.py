"""AWE task approval helpers for production-like multi-user flows."""

from __future__ import annotations

import os
import time
from typing import Any

from helpers.config import Config
from helpers.http import StaffClient
from helpers.util import assert_ok, noop, response_payload, StepFn

REGISTRY_CHANGE_REQUEST_ARTIFACT = "registry.change_request"
REGISTRY_INTAKE_FORM_ARTIFACT = "registry.intake_form"


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


def stage1_user() -> tuple[str, str]:
    return (
        _env("FUNC_AWE_STAGE1_USERNAME", "alex.carter"),
        _env("FUNC_AWE_STAGE1_PASSWORD", "alex.carter-pass"),
    )


def stage2_user() -> tuple[str, str]:
    return (
        _env("FUNC_AWE_STAGE2_USERNAME", "nina.patel"),
        _env("FUNC_AWE_STAGE2_PASSWORD", "nina.patel-pass"),
    )


def _task_wait_seconds() -> float:
    return float(_env("FUNC_AWE_TASK_WAIT_SECONDS", "60"))


def _find_actionable_task(
    staff: StaffClient,
    *,
    artifact_type: str,
    artifact_id: str,
    search_text: str,
) -> dict[str, Any] | None:
    body = staff.post_json(
        "/awe/list_my_tasks",
        {
            "artifact_type": artifact_type,
            "status": "open",
        },
        pagination_request={
            "current_page": 1,
            "page_size": 25,
            "search_text": search_text,
        },
    )
    payload = response_payload(body)
    page = payload.get("data") if isinstance(payload, dict) else None
    items = page.get("items") if isinstance(page, dict) else None
    tasks = items if isinstance(items, list) else []
    return next(
        (
            t
            for t in tasks
            if isinstance(t, dict)
            and t.get("artifact_id") == artifact_id
            and str(t.get("status") or "").lower() in {"open", "claimed"}
        ),
        None,
    )


def _matching_task(
    staff: StaffClient,
    *,
    artifact_type: str,
    artifact_id: str,
    search_text: str,
    step: StepFn,
) -> dict[str, Any]:
    timeout_s = _task_wait_seconds()
    interval_s = 2.0
    search_variants = [search_text] if search_text else [""]
    if search_text:
        search_variants.append("")

    step(
        f"awe/list_my_tasks [{artifact_type}] search={search_text!r} "
        f"(poll up to {timeout_s:.0f}s)"
    )
    deadline = time.time() + timeout_s
    last_variant = search_text
    while time.time() < deadline:
        for variant in search_variants:
            last_variant = variant
            task = _find_actionable_task(
                staff,
                artifact_type=artifact_type,
                artifact_id=artifact_id,
                search_text=variant,
            )
            if task:
                return task
        time.sleep(interval_s)

    assert False, (
        f"no actionable AWE task for artifact_id={artifact_id} "
        f"search={search_text!r} after {timeout_s:.0f}s (last_search={last_variant!r})"
    )


def approve_artifact_stage(
    cfg: Config,
    *,
    username: str,
    password: str,
    artifact_type: str,
    artifact_id: str,
    search_text: str,
    comment: str,
    step: StepFn = noop,
) -> dict[str, Any]:
    with StaffClient.login_as(cfg, username, password) as staff:
        task = _matching_task(
            staff,
            artifact_type=artifact_type,
            artifact_id=artifact_id,
            search_text=search_text,
            step=step,
        )
        task_id = str(task.get("id") or "")
        stage_order = int(task.get("stage_order") or 0)
        assert task_id and stage_order, f"invalid task payload: {task!r}"

        step(f"awe/submit_task_decision task_id={task_id} stage={stage_order} user={username}")
        submit = staff.post_json(
            "/awe/submit_task_decision",
            {
                "task_id": task_id,
                "action": "approve",
                "comment": comment,
                "artifact_id": artifact_id,
                "artifact_type": artifact_type,
                "current_stage": stage_order,
            },
        )
        payload = assert_ok(submit, "submit_task_decision")
        return payload if isinstance(payload, dict) else {}


def approve_two_stage_awe(
    cfg: Config,
    *,
    artifact_type: str,
    artifact_id: str,
    search_text: str,
    step: StepFn = noop,
) -> None:
    user1, pass1 = stage1_user()
    approve_artifact_stage(
        cfg,
        username=user1,
        password=pass1,
        artifact_type=artifact_type,
        artifact_id=artifact_id,
        search_text=search_text,
        comment="Stage 1 approve by Alex Carter",
        step=step,
    )

    user2, pass2 = stage2_user()
    approve_artifact_stage(
        cfg,
        username=user2,
        password=pass2,
        artifact_type=artifact_type,
        artifact_id=artifact_id,
        search_text=search_text,
        comment="Stage 2 approve by Nina Patel",
        step=step,
    )

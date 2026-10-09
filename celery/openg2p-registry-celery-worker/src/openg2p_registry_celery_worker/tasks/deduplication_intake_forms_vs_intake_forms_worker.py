import logging
import importlib
from datetime import datetime, timedelta

from sqlalchemy import or_, select, inspect
from sqlalchemy.orm import sessionmaker
from openg2p_registry_core.models import (
    G2PIntakeFormSubmission,
    G2PRegisterDefinition,
    G2PRegisterSchema,
    G2PRegisterSection,
    RegisterPurposeEnum,
    ApprovalStatusEnum,
    DeduplicationStatusEnum,
    DeduplicationIntakeFormIntakeFormResult,
)

from ..app import celery_app
from ..config import Settings
from ..engine import Engine
from ..control import task_enabled

_config = Settings.get_config()
_logger = logging.getLogger(_config.logging_default_logger_name)
_engine = Engine.get_engine()


@celery_app.task(name="deduplication_intake_forms_vs_intake_forms_worker", bind=True, max_retries=3)
def deduplication_intake_forms_vs_intake_forms_worker(self, submission_id: str):
    if not task_enabled():
        _logger.info("%s is disabled", "deduplication_intake_forms_vs_intake_forms_worker")
        return
    session_maker = sessionmaker(bind=_engine, expire_on_commit=False)

    with session_maker() as session:
        submission: G2PIntakeFormSubmission = None
        try:
            _logger.info(
                f"Starting deduplication_intake_forms_vs_intake_forms for submission: {submission_id} "
                f"(attempt {self.request.retries + 1}/{self.max_retries + 1})"
            )

            submission = session.get(G2PIntakeFormSubmission, submission_id)
            if not submission:
                raise Exception(f"Intake form submission not found: {submission_id}")

            _logger.info(
                f"Loaded submission {submission_id}: register_id={submission.register_id}, "
                f"approval_status={submission.approval_status}, "
                f"deduplication_status_vs_intake_forms={submission.deduplication_status_vs_intake_forms}"
            )

            # Find all sections for this form's register
            sections = session.execute(
                select(G2PRegisterSection).where(
                    G2PRegisterSection.register_id == str(submission.register_id)
                )
            ).scalars().all()

            _logger.info(
                f"Found {len(sections)} section(s) for register_id={submission.register_id}: "
                f"{[s.section_mnemonic for s in sections]}"
            )

            # Keep only sections whose section_register has purpose == REGISTER
            register_sections = []
            for section in sections:
                sec_reg_def = session.get(G2PRegisterDefinition, section.section_register_id)
                if sec_reg_def and sec_reg_def.register_purpose == RegisterPurposeEnum.REGISTER.value:
                    register_sections.append((section, sec_reg_def))
                else:
                    _logger.info(
                        f"Skipping section {section.section_mnemonic} "
                        f"(section_register_id={section.section_register_id}): "
                        f"purpose={sec_reg_def.register_purpose if sec_reg_def else 'NOT_FOUND'}"
                    )

            _logger.info(
                f"Filtered to {len(register_sections)} REGISTER-purpose section(s): "
                f"{[s.section_mnemonic for s, _ in register_sections]}"
            )

            if not register_sections:
                _logger.info(
                    f"No REGISTER-purpose sections for submission {submission_id}; nothing to deduplicate."
                )
                submission.deduplication_status_vs_intake_forms = DeduplicationStatusEnum.COMPLETED.value
                submission.deduplication_intake_forms_error = None
                submission.deduplication_intake_forms_process_timestamp = datetime.utcnow()
                submission.deduplication_intake_forms_attempts += 1
                session.commit()
                return

            # Delete any existing results for this submission (idempotent on retry)
            existing = session.execute(
                select(DeduplicationIntakeFormIntakeFormResult).where(
                    DeduplicationIntakeFormIntakeFormResult.submission_id == submission_id
                )
            ).scalars().all()
            if existing:
                _logger.info(f"Deleting {len(existing)} existing dedup result(s) for submission {submission_id} before recompute.")
            for row in existing:
                session.delete(row)
            session.flush()

            # Load domain factory once
            domain_factory_module = importlib.import_module(
                "openg2p_registry_extensions.register_domain.factory"
            )
            FactoryClass = getattr(domain_factory_module, "G2PRegisterDomainFactory")
            domain_factory = FactoryClass.get_component()
            if not domain_factory:
                domain_factory = FactoryClass()

            model_module = importlib.import_module(
                "openg2p_registry_extensions.register_domain.models"
            )

            for section, sec_reg_def in register_sections:
                _logger.info(
                    f"Processing section: {section.section_mnemonic} "
                    f"(section_register_id={section.section_register_id}, mnemonic={sec_reg_def.register_mnemonic})"
                )

                intake_class = getattr(
                    model_module, f"G2PIntakeForm{sec_reg_def.register_mnemonic}", None
                )
                if intake_class is None:
                    _logger.warning(
                        f"No intake form model for {sec_reg_def.register_mnemonic}, skipping section."
                    )
                    continue

                # Records for the current submission (list sections → multiple rows)
                intake_records = session.execute(
                    select(intake_class).where(intake_class.submission_id == submission_id)
                ).scalars().all()

                if not intake_records:
                    _logger.info(
                        f"No intake records for section {section.section_mnemonic} "
                        f"(register {sec_reg_def.register_mnemonic}), submission {submission_id}."
                    )
                    continue

                _logger.info(
                    f"Found {len(intake_records)} intake record(s) for submission {submission_id} "
                    f"in section {section.section_mnemonic}."
                )

                domain_service = domain_factory.get_domain_service(sec_reg_def.register_mnemonic)
                if not domain_service:
                    _logger.warning(
                        f"No domain service for {sec_reg_def.register_mnemonic}, skipping section."
                    )
                    continue

                _logger.info(f"Resolved domain service for mnemonic={sec_reg_def.register_mnemonic}: {type(domain_service).__name__}")

                schema_row = session.execute(
                    select(G2PRegisterSchema).where(
                        G2PRegisterSchema.register_id == str(section.section_register_id)
                    )
                ).scalar()
                deduplicate_schema = (schema_row.deduplicate_schema if schema_row else None) or []
                if not sec_reg_def.dedup_is_enabled or not deduplicate_schema:
                    _logger.info(
                        f"Dedup schema is off for section {section.section_mnemonic}; skipping."
                    )
                    continue

                for idx, intake_record in enumerate(intake_records):
                    incoming_dict = {
                        col.name: getattr(intake_record, col.name)
                        for col in inspect(intake_class).columns
                        if col.name not in {"submission_id"}
                    }
                    other_records = _find_intake_dedup_candidates(
                        session,
                        domain_service,
                        intake_class,
                        submission,
                        incoming_dict,
                        deduplicate_schema,
                    )
                    other_change_requests = [
                        {
                            "change_request_id": str(other_record.submission_id),
                            "change_payload": {
                                col.name: getattr(other_record, col.name)
                                for col in inspect(intake_class).columns
                                if col.name not in {"submission_id"}
                            },
                        }
                        for other_record in other_records
                    ]

                    _logger.info(
                        f"Found {len(other_change_requests)} intake candidate(s) for intake record "
                        f"{idx + 1}/{len(intake_records)} in section {section.section_mnemonic}."
                    )

                    if not other_change_requests:
                        continue

                    _logger.info(
                        f"Computing deduplication scores for intake record {idx + 1}/{len(intake_records)} "
                        f"of submission {submission_id} in section {section.section_mnemonic} "
                        f"against {len(other_change_requests)} candidate(s)."
                    )

                    results = domain_service.compute_deduplication_score_for_change_request(
                        submission_id,
                        str(section.section_register_id),
                        incoming_dict,
                        other_change_requests,
                        session,
                    )

                    _logger.info(
                        f"Score computation returned {len(results)} result(s) for intake record "
                        f"{idx + 1} of submission {submission_id} in section {section.section_mnemonic}."
                    )

                    # Deduplicate by candidate_submission_id — keep best score when a
                    # candidate has multiple section records.
                    best: dict[str, dict] = {}
                    for result in results:
                        cid = result["candidate_id"]
                        if cid not in best or result["score"] > best[cid]["score"]:
                            best[cid] = result

                    _logger.info(
                        f"After deduplication by candidate_id: {len(best)} unique candidate(s) with scores: "
                        f"{[(cid, r['score']) for cid, r in best.items()]}"
                    )

                    for result in best.values():
                        session.add(DeduplicationIntakeFormIntakeFormResult(
                            submission_id=submission_id,
                            section_register_id=str(section.section_register_id),
                            candidate_submission_id=result["candidate_id"],
                            match_score=result["score"],
                            field_matches=result.get("field_matches", {}),
                        ))

            submission.deduplication_status_vs_intake_forms = DeduplicationStatusEnum.COMPLETED.value
            submission.deduplication_intake_forms_error = None
            submission.deduplication_intake_forms_process_timestamp = datetime.utcnow()
            submission.deduplication_intake_forms_attempts += 1
            session.commit()

            _logger.info(
                f"Completed deduplication_intake_forms_vs_intake_forms for submission: {submission_id}"
            )

        except Exception as e:
            _logger.error(
                f"Error in deduplication_intake_forms_vs_intake_forms_worker for submission "
                f"{submission_id}: {str(e)}"
            )
            session.rollback()

            if submission:
                submission.deduplication_intake_forms_attempts += 1
                submission.deduplication_intake_forms_process_timestamp = datetime.utcnow()
                if self.request.retries < self.max_retries:
                    submission.deduplication_status_vs_intake_forms = DeduplicationStatusEnum.PENDING.value
                    _logger.info(
                        f"Retrying deduplication_intake_forms_vs_intake_forms for submission: {submission_id}"
                    )
                else:
                    submission.deduplication_status_vs_intake_forms = DeduplicationStatusEnum.FAILED.value
                    submission.deduplication_intake_forms_error = str(e)
                    _logger.error(f"Max retries exceeded for submission: {submission_id}")

                session.add(submission)
                session.commit()

            raise e


def _find_intake_dedup_candidates(session, domain_service, intake_class, submission, incoming, deduplicate_schema):
    """Other not-yet-approved intake rows that share a dedup field, same rules as register search."""
    match_type = domain_service.DeduplicationMatchType
    query_conditions = []
    for dedup_field in deduplicate_schema:
        field_name = dedup_field.get("field_name")
        normalized = domain_service._normalize_match_type(
            dedup_field.get("match_type", match_type.EXACT.value)
        )
        incoming_value = incoming.get(field_name)
        if not incoming_value or not hasattr(intake_class, field_name):
            continue
        column = getattr(intake_class, field_name)
        if normalized == match_type.EXACT.value:
            query_conditions.append(column == incoming_value)
        elif normalized == match_type.FUZZY.value:
            query_conditions.append(column.ilike(f"%{incoming_value}%"))
        elif normalized == match_type.PHONETIC.value:
            phonetic_prefix = str(incoming_value).strip().lower()[:3]
            query_conditions.append(column.ilike(f"{phonetic_prefix}%"))
        elif normalized == match_type.NUMERIC_RANGE.value:
            range_value = dedup_field.get("range_value", 0)
            try:
                incoming_num = float(incoming_value)
                query_conditions.append(column.between(incoming_num - range_value, incoming_num + range_value))
            except (ValueError, TypeError):
                continue
        elif normalized == match_type.DATE_RANGE.value:
            range_days = dedup_field.get("range_days", 0)
            try:
                incoming_date = (
                    datetime.fromisoformat(incoming_value).date()
                    if isinstance(incoming_value, str)
                    else incoming_value
                )
                query_conditions.append(column.between(
                    incoming_date - timedelta(days=range_days),
                    incoming_date + timedelta(days=range_days),
                ))
            except (ValueError, TypeError):
                continue
    if not query_conditions:
        return []
    return (
        session.execute(
            select(intake_class)
            .join(
                G2PIntakeFormSubmission,
                G2PIntakeFormSubmission.submission_id == intake_class.submission_id,
            )
            .where(
                G2PIntakeFormSubmission.register_id == submission.register_id,
                intake_class.submission_id != submission.submission_id,
                G2PIntakeFormSubmission.approval_status != ApprovalStatusEnum.APPROVED.value,
                or_(*query_conditions),
            )
        )
        .scalars()
        .all()
    )

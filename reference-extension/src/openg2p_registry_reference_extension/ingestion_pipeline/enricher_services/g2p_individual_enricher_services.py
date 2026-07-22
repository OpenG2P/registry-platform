import logging
from typing import Any, Dict, Optional

from openg2p_registry_core.interfaces import G2PPayloadEnricherInterface
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...register_domain.models import G2PRegisterIndividual

_logger = logging.getLogger('g2p-payload-enricher-service')


def _merge_additional_attributes(raw: Any) -> Dict[str, Any]:
    """DO.SR.02 allows additional_attributes as 0…1 object or, in practice, a list of objects; merge into one dict (later keys win)."""
    merged: Dict[str, Any] = {}
    if isinstance(raw, dict):
        merged.update(raw)
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                merged.update(item)
    return merged


def _normalize_crvs_envelope(data: Dict[str, Any]) -> Dict[str, Any]:
    """Accept staff/partner flat body ``{jwt, disclosures, kbJwt}`` or legacy ``{vc: {...}, vcStatus}``."""
    if not isinstance(data, dict):
        return {}
    legacy_vc = data.get('vc')
    if isinstance(legacy_vc, dict):
        return legacy_vc
    if isinstance(data.get('jwt'), dict):
        return data
    return data


def _resolve_parent_link_internal_record_id(envelope: Dict[str, Any], session: Session) -> Optional[str]:
    jwt_payload = (envelope.get('jwt') or {}).get('payload') or {}
    parents_data = jwt_payload.get('parents')
    if isinstance(parents_data, dict):
        parents_data = [parents_data]
    elif not isinstance(parents_data, list):
        parents_data = []

    for parent in parents_data:
        if not isinstance(parent, dict):
            continue
        identifier_value = parent.get('identifier')
        if not identifier_value:
            continue
        parent_individual = session.execute(
            select(G2PRegisterIndividual).where(
                G2PRegisterIndividual.foundational_id == str(identifier_value)
            )
        ).scalar_one_or_none()
        if parent_individual and parent_individual.link_internal_record_id:
            _logger.info(
                'G2PCrvsVCIndividualCreateEnricherService: parent match foundational_id=%s link_internal_record_id=%s',
                identifier_value,
                parent_individual.link_internal_record_id,
            )
            return parent_individual.link_internal_record_id
    return None


# DCI Payload Enrichers
class G2PDciIndividualCreateEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PDciIndividualCreateEnricherService")
        if isinstance(data, dict):
            data["additional_attributes"] = _merge_additional_attributes(
                data.get("additional_attributes")
            )
        return data


class G2PDciIndividualUpdateEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PDciIndividualUpdateEnricherService")
        return data


class G2PDciIndividualDeleteEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PDciIndividualDeleteEnricherService")
        return data


# SPDCI Payload Enrichers
class G2PSpdciIndividualCreateEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PSpdciIndividualCreateEnricherService")
        return data


class G2PSpdciIndividualUpdateEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PSpdciIndividualUpdateEnricherService")
        return data


class G2PSpdciIndividualDeleteEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PSpdciIndividualDeleteEnricherService")
        return data


# UNDP Payload Enrichers
class G2PUndpIndividualCreateEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PUndpIndividualCreateEnricherService")
        return data


class G2PUndpIndividualUpdateEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PUndpIndividualUpdateEnricherService")
        return data


class G2PUndpIndividualDeleteEnricherService(G2PPayloadEnricherInterface):
    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PUndpIndividualDeleteEnricherService")
        return data


class G2PCrvsVCIndividualCreateEnricherService(G2PPayloadEnricherInterface):
    """Resolve parent household link on CRVS SD-JWT ingest body.

    Expects business payload ``$.body`` = ``{jwt, disclosures, kbJwt}`` (flat POST body).
    Legacy wrapped payloads ``{vc: {jwt, ...}, vcStatus}`` are normalized before lookup.
    Field mapping is performed by ``crvsvc_to_individual.json.j2``.
    """

    def enrich(self, data: Dict, session: Session) -> Dict:
        _logger.info("Processing G2PCrvsVCIndividualCreateEnricherService")
        if not isinstance(data, dict):
            return data

        envelope = _normalize_crvs_envelope(data)
        out = dict(envelope)
        parent_link = _resolve_parent_link_internal_record_id(envelope, session)
        if parent_link:
            out['link_internal_record_id'] = parent_link
        else:
            _logger.warning("No parent link found for CRVS SD-JWT ingest body")
            raise ValueError("No parent link found for CRVS SD-JWT ingest body")

        return out

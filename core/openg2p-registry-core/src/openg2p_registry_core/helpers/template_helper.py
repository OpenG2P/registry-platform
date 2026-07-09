import io
import json
from datetime import timedelta
from jinja2 import Template, Environment
from pyld import jsonld
from typing import Dict
from openg2p_fastapi_common.service import BaseService

from ...models.enum import DocumentBucket
from .document import get_document_handler


class TemplateHelper(BaseService):
    """
    Template storage/rendering helper. Templates live in the TEMPLATES bucket
    and are addressed by their document_store_id (resolved from the
    g2p_registry_documents catalog by callers).
    """

    def __init__(self):
        super().__init__()
        self.env = Environment()

    def get_template(self, document_store_id: str) -> str:
        return get_document_handler().download(
            document_store_id, DocumentBucket.TEMPLATES
        ).decode("utf-8")

    def put_template(self, template: str) -> str:
        """Store a template and return the generated document_store_id."""
        encoded_template = template.encode("utf-8")
        return get_document_handler().upload(
            data=io.BytesIO(encoded_template),
            length=len(encoded_template),
            bucket=DocumentBucket.TEMPLATES,
            content_type="text/plain",
        )

    def delete_template(self, document_store_id: str):
        return get_document_handler().delete(document_store_id, DocumentBucket.TEMPLATES)

    def get_template_url(
        self,
        document_store_id: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        return get_document_handler().get_url(
            document_store_id,
            DocumentBucket.TEMPLATES,
            expires=expires,
        )

    def get_jinja_template(self, document_store_id: str) -> Template:
        template: Template = self.env.from_string(self.get_template(document_store_id))
        return template

    def render_with_template(self, document_store_id: str, data: Dict, expand_data: bool = True) -> Dict:
        if expand_data:
            expanded_data = jsonld.expand(data)
        else:
            expanded_data = data

        jinja_template = self.get_jinja_template(document_store_id)
        rendered_data: str = jinja_template.render(expanded=expanded_data)
        return json.loads(rendered_data)

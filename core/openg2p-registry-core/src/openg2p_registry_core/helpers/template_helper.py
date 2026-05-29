import io
import json
from datetime import timedelta
from jinja2 import Template, Environment
from pyld import jsonld
from typing import Dict
from openg2p_fastapi_common.service import BaseService

from ..helpers import MinioClient

class TemplateHelper(BaseService):
    def __init__(self, template_bucket_name: str):
        super().__init__()
        self.env = Environment()
        self.template_bucket_name = template_bucket_name

    def get_template(self, minio_client: MinioClient, template_file_id: str) -> str:
        return minio_client.get_object(template_file_id, bucket_name=self.template_bucket_name).decode("utf-8")
    
    def put_template(self, minio_client: MinioClient, template_file_id: str, template: str):
        encoded_template = template.encode("utf-8")
        return minio_client.put_object(
            object_name=template_file_id,
            data=io.BytesIO(encoded_template),
            length=len(encoded_template),
            bucket_name=self.template_bucket_name
        )
    
    def delete_template(self, minio_client: MinioClient, template_file_id: str):
        return minio_client.delete_object(template_file_id, bucket_name=self.template_bucket_name)

    def get_template_url(
        self,
        minio_client: MinioClient,
        template_file_id: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        return minio_client.get_url(
            template_file_id,
            bucket_name=self.template_bucket_name,
            expires=expires,
        )

    def get_jinja_template(self, minio_client: MinioClient, template_file_id: str) -> Template:
        template: Template = self.env.from_string(self.get_template(minio_client,template_file_id))
        return template
    
    def render_with_template(self, minio_client: MinioClient, template_file_id: str, data: Dict, expand_data: bool = True) -> Dict:
        if expand_data:
            expanded_data = jsonld.expand(data)
        else:
            expanded_data = data

        jinja_template = self.get_jinja_template(minio_client, template_file_id)
        rendered_data: str = jinja_template.render(expanded=expanded_data)
        return json.loads(rendered_data)

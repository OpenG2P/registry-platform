import uuid
from minio import Minio
from minio.error import S3Error
from minio.helpers import ObjectWriteResult
from typing import Optional, BinaryIO
from datetime import timedelta
from enum import Enum

from openg2p_fastapi_common.service import BaseService

class MinioBucketEnum(Enum):
    DEFAULT = "default"
    TEMPLATES = "templates"
    DOCUMENTS = "documents"
    RECORD_IMAGES = "record_images"
    DATA_IMPORT_FILES = "data_import_files"

class MinioClient(BaseService):
    """
    Generic MinIO client wrapper with common helper methods.
    """
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        secure: bool,
        default_bucket: Optional[str]
    ):
        super().__init__()
        self.client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self.default_bucket = default_bucket

    # Bucket Management
    def ensure_bucket(self, bucket_name: Optional[str] = None):
        bucket_name = bucket_name or self.default_bucket
        if not bucket_name:
            raise ValueError("Bucket name is required.")

        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)

    # Upload Object
    def put_object(
        self,
        object_name: Optional[str],
        data: BinaryIO,
        length: int,
        bucket_name: Optional[str] = None,
        content_type: str = "application/octet-stream",
    ) -> str:
        bucket_name = bucket_name or self.default_bucket
        self.ensure_bucket(bucket_name)

        object_name = object_name or uuid.uuid4().hex       # uuid.hex -> remove hyphens

        object_write_result: ObjectWriteResult = self.client.put_object(
            bucket_name=bucket_name,
            object_name=object_name,
            data=data,
            length=length,
            content_type=content_type,
        )
        return object_write_result.object_name

    # Download Object
    def get_object(
        self,
        object_name: str,
        bucket_name: Optional[str] = None,
    ) -> bytes:
        bucket_name = bucket_name or self.default_bucket

        try:
            response = self.client.get_object(bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data

        except S3Error as exc:
            raise RuntimeError(f"Failed to download: {exc}") from exc

    # Presigned URL
    def get_url(
        self,
        object_name: str,
        bucket_name: Optional[str] = None,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        bucket_name = bucket_name or self.default_bucket

        return self.client.presigned_get_object(
            bucket_name=bucket_name,
            object_name=object_name,
            expires=expires,
        )

    # List Objects
    def list_objects(
        self,
        bucket_name: Optional[str] = None,
        prefix: str = "",
    ) -> list:
        bucket_name = bucket_name or self.default_bucket

        return list(self.client.list_objects(bucket_name, prefix=prefix, recursive=True))

    # Delete Object
    def delete_object(
        self,
        object_name: str,
        bucket_name: Optional[str] = None,
    ) -> None:
        bucket_name = bucket_name or self.default_bucket
        return self.client.remove_object(bucket_name, object_name)

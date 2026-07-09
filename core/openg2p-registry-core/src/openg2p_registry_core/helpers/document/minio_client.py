from datetime import timedelta
from typing import BinaryIO

from minio import Minio
from minio.error import S3Error

from .minio_client import MinioClient
from ...models.enum import DocumentBucket
from .document_handlers import DocumentHandler


class MinioClient(DocumentHandler):
    """
    MinIO implementation of DocumentHandler.

    Do not use directly; obtain via document_factory.get_document_handler().
    """

    def __init__(self, endpoint: str, access_key: str, secret_key: str, secure: bool):
        super().__init__()
        self.client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )

    def _ensure_bucket(self, bucket: DocumentBucket) -> str:
        bucket_name = bucket.value
        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)
        return bucket_name

    def upload(
        self,
        data: BinaryIO,
        length: int,
        bucket: DocumentBucket,
        content_type: str = "application/octet-stream",
    ) -> str:
        bucket_name = self._ensure_bucket(bucket)
        document_store_id = self.generate_store_id()
        self.client.put_object(
            bucket_name=bucket_name,
            object_name=document_store_id,
            data=data,
            length=length,
            content_type=content_type,
        )
        return document_store_id

    def download(self, document_store_id: str, bucket: DocumentBucket) -> bytes:
        try:
            response = self.client.get_object(bucket.value, document_store_id)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as exc:
            raise RuntimeError(f"Failed to download: {exc}") from exc

    def delete(self, document_store_id: str, bucket: DocumentBucket) -> None:
        self.client.remove_object(bucket.value, document_store_id)

    def get_url(
        self,
        document_store_id: str,
        bucket: DocumentBucket,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        return self.client.presigned_get_object(
            bucket_name=bucket.value,
            object_name=document_store_id,
            expires=expires,
        )

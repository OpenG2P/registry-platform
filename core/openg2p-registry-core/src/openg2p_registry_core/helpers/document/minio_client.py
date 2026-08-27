from datetime import timedelta
from typing import BinaryIO, Optional

from minio import Minio
from minio.error import S3Error

from ...models.enum import DocumentBucket
from .document_handlers import DocumentHandler


class MinioClient(DocumentHandler):
    """MinIO DocumentHandler. Obtain via document_factory.get_document_handler()."""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        secure: bool,
        read_access_key: Optional[str] = None,
        read_secret_key: Optional[str] = None,
    ):
        super().__init__()
        self.client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self.readonly_client = Minio(
            endpoint=endpoint,
            access_key=read_access_key or access_key,
            secret_key=read_secret_key or secret_key,
            secure=secure,
        )

    def _ensure_bucket(self, bucket: DocumentBucket) -> DocumentBucket:
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)
        return bucket

    def upload(
        self,
        data: BinaryIO,
        length: int,
        bucket: DocumentBucket,
        content_type: str = "application/octet-stream",
        object_name: str | None = None,
    ) -> str:
        bucket_name = self._ensure_bucket(bucket)
        document_store_id = object_name or self.generate_store_id()
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
            response = self.client.get_object(bucket, document_store_id)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as exc:
            raise RuntimeError(f"Failed to download: {exc}") from exc

    def delete(self, document_store_id: str, bucket: DocumentBucket) -> None:
        self.client.remove_object(bucket, document_store_id)

    def get_url(
        self,
        document_store_id: str,
        bucket: DocumentBucket,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        return self.readonly_client.presigned_get_object(
            bucket_name=bucket,
            object_name=document_store_id,
            expires=expires,
        )

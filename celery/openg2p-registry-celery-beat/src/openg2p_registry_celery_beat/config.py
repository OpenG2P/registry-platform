from openg2p_registry_extensions.config import Settings as ExtSettings
from pydantic_settings import SettingsConfigDict

from typing import Optional

from . import __version__


class Settings(ExtSettings):
    model_config = SettingsConfigDict(
        env_prefix="registry_celery_beat_", env_file=".env", extra="allow"
    )
    openapi_title: str = "OpenG2P Registry Celery Beat Producers"
    openapi_description: str = """
        Celery Beat Producers for OpenG2P Registry
        ***********************************
        Further details goes here
        ***********************************
        """
    openapi_version: str = __version__

    # Registry Database
    db_driver: str = "postgresql"
    db_username: str = "postgres"
    db_password: str = "password"
    db_hostname: str = "localhost"
    db_port: int = 5432
    db_dbname: str = "registrydb"

    # Celery Configuration
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_backend_url: str = "redis://localhost:6379/0"
    worker_queue: str = "registry_worker_queue"

    # Shared fallbacks. A set per-producer frequency or no_of_tasks replaces these.
    no_of_tasks_to_process: int = 4
    default_beat_producer_frequency: int = 20

    # Ingest. ingest_data also claims UPDATE rows for change_request_ingest.
    ingest_data_beat_producer_frequency: Optional[int] = None
    ingest_data_beat_producer_enabled: bool = True
    ingest_data_beat_producer_no_of_tasks: Optional[int] = None

    ingest_data_classification_beat_producer_frequency: Optional[int] = None
    ingest_data_classification_beat_producer_enabled: bool = True
    ingest_data_classification_beat_producer_no_of_tasks: Optional[int] = None

    # Shared by ingest transformation and outgest transformation.
    data_transformation_beat_producer_frequency: Optional[int] = None
    ingest_data_transformation_beat_producer_enabled: bool = True
    ingest_data_transformation_beat_producer_no_of_tasks: Optional[int] = None

    # Outgest
    outgest_data_transformation_beat_producer_enabled: bool = True
    outgest_data_transformation_beat_producer_no_of_tasks: Optional[int] = None

    outgest_data_publish_beat_producer_frequency: Optional[int] = None
    outgest_data_publish_beat_producer_enabled: bool = True
    outgest_data_publish_beat_producer_no_of_tasks: Optional[int] = None

    outgest_topic_register_beat_producer_frequency: Optional[int] = None
    outgest_topic_register_beat_producer_enabled: bool = True
    outgest_topic_register_beat_producer_no_of_tasks: Optional[int] = None

    # Deduplication. One frequency for all four producers.
    deduplication_beat_producer_frequency: Optional[int] = None
    deduplication_register_beat_producer_enabled: bool = True
    deduplication_register_beat_producer_no_of_tasks: Optional[int] = None
    deduplication_change_request_beat_producer_enabled: bool = True
    deduplication_change_request_beat_producer_no_of_tasks: Optional[int] = None
    deduplication_intake_forms_vs_register_beat_producer_enabled: bool = True
    deduplication_intake_forms_vs_register_beat_producer_no_of_tasks: Optional[int] = None
    deduplication_intake_forms_vs_intake_forms_beat_producer_enabled: bool = True
    deduplication_intake_forms_vs_intake_forms_beat_producer_no_of_tasks: Optional[int] = None

    # Intake register ingest
    intake_form_register_ingest_beat_producer_frequency: Optional[int] = None
    intake_form_register_ingest_beat_producer_enabled: bool = True
    intake_form_register_ingest_beat_producer_no_of_tasks: Optional[int] = None

    # Functional id
    functional_id_allocation_beat_producer_frequency: Optional[int] = None
    functional_id_allocation_beat_producer_enabled: bool = True
    functional_id_allocation_beat_producer_no_of_tasks: Optional[int] = None
    functional_id_updation_beat_producer_frequency: Optional[int] = None
    functional_id_updation_beat_producer_enabled: bool = True
    functional_id_updation_beat_producer_no_of_tasks: Optional[int] = None

    # Score
    score_compute_beat_producer_frequency: Optional[int] = None
    score_compute_beat_producer_enabled: bool = True
    score_compute_beat_producer_no_of_tasks: Optional[int] = None
    completion_score_beat_producer_frequency: Optional[int] = None
    completion_score_beat_producer_enabled: bool = True
    completion_score_beat_producer_no_of_tasks: Optional[int] = None

    # Import file
    import_file_process_beat_producer_frequency: Optional[int] = None
    import_file_process_beat_producer_enabled: bool = True
    import_file_process_beat_producer_no_of_tasks: Optional[int] = None

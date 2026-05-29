from typing import Optional

from pydantic import BaseModel


class ImportFileConfigurationData(BaseModel):
    import_file_configuration_id: str
    register_id: str
    form_id: str
    data_model_id: str
    import_file_template_mnemonic: str
    import_file_template_description: str

    class Config:
        from_attributes: bool = True


class ImportFileConfigurationRequestPayload(BaseModel):
    register_id: Optional[str] = None


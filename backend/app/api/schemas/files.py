import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileResponse(BaseModel):
    """Response schema for an uploaded file."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_filename: str
    content_type: str | None
    file_size: int
    created_at: datetime


class FileListResponse(BaseModel):
    """Response schema for a collection of uploaded files."""

    files: list[FileResponse]
    total: int


class DatasetLoadResponse(BaseModel):
    """Response schema for a loaded dataset."""

    dataset_id: str
    filename: str
    rows: int
    columns: int
    column_names: list[str]
    file_size: int

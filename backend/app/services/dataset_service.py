from pathlib import Path
import uuid

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import File
from app.storage.base import BaseStorage
from app.tools.dataset_registry import DatasetRegistry


class DatasetService:
    def __init__(
        self,
        session: AsyncSession,
        storage: BaseStorage,
        dataset_registry: DatasetRegistry,
    ):
        self.session = session
        self.storage = storage
        self.dataset_registry = dataset_registry

    async def load_dataset(self, file_id: uuid.UUID) -> dict:
        """Load an uploaded file and register it as a dataset."""

        file_record = await self.session.get(File, file_id)

        if file_record is None:
            raise ValueError("File not found.")

        storage_path = self.storage.get_path(file_record.storage_key)

        if not storage_path.is_file():
            raise FileNotFoundError("Uploaded file does not exist in storage.")

        extension = Path(file_record.original_filename).suffix.lower()

        if extension == ".csv":
            df = pd.read_csv(storage_path)
        elif extension in {".xlsx", ".xls"}:
            df = pd.read_excel(storage_path)
        else:
            raise ValueError("Unsupported dataset format.")

        metadata = {
            "filename": file_record.original_filename,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "file_size": file_record.file_size,
        }

        dataset_id = str(file_id)

        registered_id = self.dataset_registry.register(
            df=df,
            metadata=metadata,
            dataset_id=dataset_id,
        )

        return {
            "dataset_id": registered_id,
            **metadata,
        }
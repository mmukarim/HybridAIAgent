import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import File
from app.storage.base import BaseStorage


class FileService:
    """Handles file storage and metadata persistence."""

    ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}

    def __init__(
        self,
        session: AsyncSession,
        storage: BaseStorage,
    ):
        self.session = session
        self.storage = storage

    async def upload_file(self, file: UploadFile) -> File:
        """Save an uploaded file and persist its metadata."""

        await self._validate_file(file)

        original_filename = file.filename or "unnamed_file"

        storage_key = await self.storage.save(file)

        try:
            file_path = self.storage.get_path(storage_key)

            file_record = File(
                original_filename=original_filename,
                storage_key=storage_key,
                content_type=file.content_type,
                file_size=file_path.stat().st_size,
            )

            self.session.add(file_record)

            await self.session.commit()
            await self.session.refresh(file_record)

            return file_record

        except Exception:
            await self.session.rollback()

            try:
                await self.storage.delete(storage_key)
            except Exception:
                # Preserve the original database exception.
                pass

            raise

    async def list_files(self) -> list[File]:
        """Return all uploaded files, newest first."""

        statement = select(File).order_by(File.created_at.desc())

        result = await self.session.scalars(statement)

        return list(result.all())

    async def get_file(
        self,
        file_id: uuid.UUID,
    ) -> File | None:
        """Retrieve file metadata by UUID."""

        return await self.session.get(File, file_id)

    async def delete_file(
        self,
        file_id: uuid.UUID,
    ) -> bool:
        """Delete the physical file and its database metadata."""

        file_record = await self.get_file(file_id)

        if file_record is None:
            return False

        try:
            # Delete the physical file first.
            await self.storage.delete(file_record.storage_key)

            # Delete database metadata.
            await self.session.delete(file_record)
            await self.session.commit()

            return True

        except Exception:
            await self.session.rollback()
            raise

    async def _validate_file(self, file: UploadFile) -> None:
        """Validate uploaded file extension and size."""

        filename = file.filename or ""
        extension = Path(filename).suffix.lower()

        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError(
                "Unsupported file format. Allowed formats: CSV, XLSX, XLS."
            )

        # Determine file size without loading it into memory.
        file.file.seek(0, 2)
        file_size = file.file.tell()
        await file.seek(0)

        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

        if file_size > max_size:
            raise ValueError(
                f"File exceeds the maximum upload size of "
                f"{settings.MAX_UPLOAD_SIZE_MB} MB."
            )

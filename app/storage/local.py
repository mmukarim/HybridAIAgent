import uuid
from pathlib import Path

from fastapi import UploadFile

from app.storage.base import BaseStorage


class LocalStorage(BaseStorage):
    """Local filesystem implementation of BaseStorage."""

    def __init__(self, storage_path: str | Path):
        self.storage_path = Path(storage_path).resolve()
        self.storage_path.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile) -> str:
        extension = Path(file.filename or "").suffix.lower()

        storage_key = f"{uuid.uuid4()}{extension}"
        destination = self.get_path(storage_key)

        with destination.open("wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)

        await file.seek(0)

        return storage_key

    def get_path(self, storage_key: str) -> Path:
        path = (self.storage_path / storage_key).resolve()

        if path.parent != self.storage_path:
            raise ValueError("Invalid storage key.")

        return path

    async def delete(self, storage_key: str) -> None:
        path = self.get_path(storage_key)

        if path.exists():
            path.unlink()

    def exists(self, storage_key: str) -> bool:
        return self.get_path(storage_key).is_file()

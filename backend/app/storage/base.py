from abc import ABC, abstractmethod
from pathlib import Path

from fastapi import UploadFile


class BaseStorage(ABC):
    """Abstract interface for file storage implementations."""

    @abstractmethod
    async def save(self, file: UploadFile) -> str:
        """Save an uploaded file and return its storage key."""
        raise NotImplementedError

    @abstractmethod
    def get_path(self, storage_key: str) -> Path:
        """Resolve a storage key to its physical file path."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, storage_key: str) -> None:
        """Delete a stored file."""
        raise NotImplementedError

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check whether a stored file exists."""
        raise NotImplementedError

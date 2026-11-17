
import asyncio
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile

from app.database import DatabaseManager
from app.services.file_service import FileService
from app.storage.local import LocalStorage
from app.config import settings


async def main():
    database = DatabaseManager(settings.DATABASE_URL)
    storage = LocalStorage("storage/test_uploads")

    await database.open()

    session_factory = database.get_session_factory()

    try:
        async with session_factory() as session:
            file_service = FileService(
                session=session,
                storage=storage,
            )

            content = b"product,revenue\nLaptop,150000\nMobile,200000"

            upload = UploadFile(
                filename="sales.csv",
                file=BytesIO(content),
            )

            # 1. Upload file
            file_record = await file_service.upload_file(upload)

            print("\nUploaded file:")
            print(f"ID: {file_record.id}")
            print(f"Filename: {file_record.original_filename}")
            print(f"Storage key: {file_record.storage_key}")
            print(f"File size: {file_record.file_size}")
            print(f"Content type: {file_record.content_type}")

            assert file_record.original_filename == "sales.csv"
            assert file_record.file_size == len(content)

            # 2. Verify physical file
            assert storage.exists(file_record.storage_key)
            print("\nPhysical file exists: True")

            # 3. Retrieve file metadata
            retrieved = await file_service.get_file(file_record.id)

            assert retrieved is not None
            assert retrieved.id == file_record.id
            print("Metadata retrieval: Passed")

            # 4. List files
            files = await file_service.list_files()

            assert any(f.id == file_record.id for f in files)
            print(f"File listing: Passed ({len(files)} records)")

            # 5. Delete file
            deleted = await file_service.delete_file(file_record.id)

            assert deleted is True
            assert not storage.exists(file_record.storage_key)

            print("File deletion: Passed")

            # 6. Verify metadata deletion
            deleted_record = await file_service.get_file(file_record.id)

            assert deleted_record is None
            print("Metadata deletion: Passed")

            print("\nAll FileService tests passed.")

    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())

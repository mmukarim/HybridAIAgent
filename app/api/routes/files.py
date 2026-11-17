import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File as FileUpload, HTTPException, UploadFile, status

from app.api.dependencies import get_file_service
from app.api.schemas.files import FileListResponse, FileResponse
from app.services.file_service import FileService


file_router = APIRouter(
    prefix="/files",
    tags=["Files"],
)


@file_router.post(
    "",
    response_model=FileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    file: Annotated[UploadFile, FileUpload(...)],
    file_service: Annotated[FileService, Depends(get_file_service)],
):
    try:
        return await file_service.upload_file(file)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@file_router.get(
    "",
    response_model=FileListResponse,
)
async def list_files(
    file_service: Annotated[FileService, Depends(get_file_service)],
):
    """List uploaded files."""

    files = await file_service.list_files()

    return {
        "files": files,
        "total": len(files),
    }


@file_router.get(
    "/{file_id}",
    response_model=FileResponse,
)
async def get_file(
    file_id: uuid.UUID,
    file_service: Annotated[FileService, Depends(get_file_service)],
):
    """Retrieve file metadata."""

    file_record = await file_service.get_file(file_id)

    if file_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    return file_record


@file_router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_file(
    file_id: uuid.UUID,
    file_service: Annotated[FileService, Depends(get_file_service)],
):
    """Delete an uploaded file."""

    deleted = await file_service.delete_file(file_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

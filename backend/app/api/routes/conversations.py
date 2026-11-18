import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_conversation_service
from app.api.schemas import (
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
    ConversationDatasetUpdate,
)
from app.services.conversation_service import ConversationService


conversation_router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


@conversation_router.post(
    "",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ConversationCreate,
    service: Annotated[
        ConversationService,
        Depends(get_conversation_service),
    ],
):
    return await service.create_conversation(
        title=payload.title,
        dataset_id=payload.dataset_id,
    )


@conversation_router.get(
    "",
    response_model=ConversationListResponse,
)
async def list_conversations(
    service: Annotated[
        ConversationService,
        Depends(get_conversation_service),
    ],
):
    conversations = await service.list_conversations()

    return ConversationListResponse(
        conversations=conversations,
        total=len(conversations),
    )


@conversation_router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
)
async def get_conversation(
    conversation_id: uuid.UUID,
    service: Annotated[
        ConversationService,
        Depends(get_conversation_service),
    ],
):
    conversation = await service.get_conversation(conversation_id)

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return conversation


@conversation_router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    service: Annotated[
        ConversationService,
        Depends(get_conversation_service),
    ],
):
    deleted = await service.delete_conversation(conversation_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )


@conversation_router.put(
    "/{conversation_id}/dataset",
    response_model=ConversationResponse,
)
async def set_conversation_dataset(
    conversation_id: uuid.UUID,
    payload: ConversationDatasetUpdate,
    conversation_service: Annotated[
        ConversationService, Depends(get_conversation_service)
    ],
):
    try:
        conversation = await conversation_service.set_dataset(
            conversation_id=conversation_id,
            file_id=payload.file_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return conversation

@conversation_router.delete(
    "/{conversation_id}/dataset",
    response_model=ConversationResponse,
)
async def remove_conversation_dataset(
    conversation_id: uuid.UUID,
    conversation_service: Annotated[
        ConversationService, Depends(get_conversation_service)
    ],
):
    conversation = await conversation_service.remove_dataset(conversation_id)

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    return {"message": "Dataset association removed successfully."}

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_conversation_service
from app.api.schemas import (
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
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

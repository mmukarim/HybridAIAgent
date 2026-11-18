import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_agent_service
from app.api.schemas.messages import MessageCreate, MessageResponse, MessageHistoryResponse, MessageHistoryItem
from app.services.agent_service import AgentService


message_router = APIRouter(tags=["Messages"])


@message_router.post(
    "/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_first_message(
    payload: MessageCreate,
    service: Annotated[
        AgentService,
        Depends(get_agent_service),
    ],
):
    """Create a conversation and process its first message."""

    return await service.send_first_message(
        message=payload.content,
    )


@message_router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
)
async def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    service: Annotated[
        AgentService,
        Depends(get_agent_service),
    ],
):
    """Send a message to an existing conversation."""

    try:
        return await service.send_message(
            conversation_id=conversation_id,
            message=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@message_router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageHistoryResponse,
)
async def get_message_history(
    conversation_id: uuid.UUID,
    agent_service: Annotated[
        AgentService,
        Depends(get_agent_service),
    ],
):
    try:
        messages = await agent_service.get_message_history(conversation_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    return MessageHistoryResponse(
        conversation_id=conversation_id,
        messages=[
            MessageHistoryItem(**message)
            for message in messages
        ],
        total=len(messages),
    )

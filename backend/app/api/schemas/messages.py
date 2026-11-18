import uuid

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(
        min_length=1,
        description="The message sent by the user.",
    )


class MessageResponse(BaseModel):
    conversation_id: uuid.UUID
    message: str
    response: str


class MessageHistoryItem(BaseModel):
    role: str
    content: str


class MessageHistoryResponse(BaseModel):
    conversation_id: uuid.UUID
    messages: list[MessageHistoryItem]
    total: int
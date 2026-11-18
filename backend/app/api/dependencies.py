from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.services.conversation_service import ConversationService
from app.services.agent_service import AgentService
from app.services.file_service import FileService
from app.services.dataset_service import DatasetService


async def get_database_session(request: Request):
    """Provide a database session for the current API request."""
    database = request.app.state.database
    session_factory = database.get_session_factory()

    async with session_factory() as session:
        yield session


def get_checkpointer(request: Request) -> AsyncPostgresSaver:
    """Provide the initialized LangGraph PostgreSQL checkpointer."""
    checkpointer_manager = request.app.state.checkpointer_manager
    return checkpointer_manager.get_checkpointer()


async def get_conversation_service(
    session: Annotated[AsyncSession, Depends(get_database_session)],
    checkpointer: Annotated[
        AsyncPostgresSaver,
        Depends(get_checkpointer),
    ],
) -> ConversationService:
    """Create a conversation service for the current API request."""
    return ConversationService(
        session=session,
        checkpointer=checkpointer,
    )


def get_file_service(
    session: Annotated[
        AsyncSession,
        Depends(get_database_session),
    ],
    request: Request,
) -> FileService:
    storage = request.app.state.storage

    return FileService(
        session=session,
        storage=storage,
    )


def get_dataset_service(
    session: Annotated[AsyncSession, Depends(get_database_session)],
    request: Request,
) -> DatasetService:
    return DatasetService(
        session=session,
        storage=request.app.state.storage,
        dataset_registry=request.app.state.dataset_registry,
    )


async def get_agent_service(
    conversation_service: Annotated[
        ConversationService,
        Depends(get_conversation_service),
    ],
    dataset_service: Annotated[
        DatasetService,
        Depends(get_dataset_service),
    ],
    request: Request,
) -> AgentService:
    """Provide an agent service for the current API request."""

    agent = request.app.state.agent

    return AgentService(
        conversation_service=conversation_service,
        agent=agent,
        dataset_service=dataset_service,
    )

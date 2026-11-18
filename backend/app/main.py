import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.api.routes import conversation_router, message_router, file_router
from app.database import DatabaseManager, CheckpointerManager
from app.storage.local import LocalStorage
from app.tools.dataset_registry import DatasetRegistry
from app.langchain_integration.agent import build_agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    database_url = settings.DATABASE_URL

    database = DatabaseManager(database_url)
    checkpointer_manager = CheckpointerManager(database_url)

    try:
        # Initialize application database pool
        await database.open()

        # Initialize PostgreSQL checkpointer
        checkpointer = await checkpointer_manager.open()

        # Initialize shared dataset registry
        dataset_registry = DatasetRegistry()

        # Build LangGraph agent with persistent checkpointing
        agent = build_agent(
            dataset_registry=dataset_registry,
            checkpointer=checkpointer,
        )

        storage = LocalStorage(settings.FILE_STORAGE_PATH)

        # Expose resources to API routes
        agent_app.state.database = database
        agent_app.state.checkpointer_manager = checkpointer_manager
        agent_app.state.dataset_registry = dataset_registry
        agent_app.state.agent = agent
        agent_app.state.storage = storage

        print("Application startup completed.")

        yield

    finally:
        # Release resources
        await checkpointer_manager.close()
        await database.close()

        print("Application shutdown completed.")


agent_app = FastAPI(
    title="Hybrid AI Agent API",
    description="API for the Hybrid AI Data Analyst Agent",
    version="1.0.0",
    lifespan=lifespan,
)


@agent_app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "application": "Hybrid AI Agent",
    }

# version 1 API routes
agent_app.include_router(conversation_router, prefix="/api/v1")
agent_app.include_router(message_router, prefix="/api/v1")
agent_app.include_router(file_router, prefix="/api/v1")

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.database import Conversation, File


class ConversationService:
    """Handles conversation persistence and lifecycle operations."""

    def __init__(
        self,
        session: AsyncSession,
        checkpointer: AsyncPostgresSaver,
    ):
        self.session = session
        self.checkpointer = checkpointer

    async def create_conversation(
        self,
        title: str = "New conversation",
        dataset_id: uuid.UUID | None = None,
    ) -> Conversation:
        """Create and persist a new conversation."""

        conversation = Conversation(
            title=title,
            dataset_id=dataset_id,
        )

        try:
            self.session.add(conversation)
            await self.session.commit()
            await self.session.refresh(conversation)

            return conversation

        except Exception:
            await self.session.rollback()
            raise

    async def list_conversations(self) -> list[Conversation]:
        """Return conversations ordered by most recently updated."""

        statement = select(Conversation).order_by(
            Conversation.updated_at.desc()
        )

        result = await self.session.scalars(statement)

        return list(result.all())

    async def get_conversation(
        self,
        conversation_id: uuid.UUID,
    ) -> Conversation | None:
        """Retrieve a conversation by its UUID."""

        return await self.session.get(
            Conversation,
            conversation_id,
        )

    async def delete_conversation(
        self,
        conversation_id: uuid.UUID,
    ) -> bool:
        """
        Delete a conversation and its LangGraph checkpoints.

        Returns False if the conversation does not exist.
        """

        conversation = await self.get_conversation(conversation_id)

        if conversation is None:
            return False

        try:
            # Delete LangGraph checkpoints first.
            await self.checkpointer.adelete_thread(
                str(conversation_id)
            )

            # Delete application-level conversation metadata.
            await self.session.delete(conversation)
            await self.session.commit()

            return True

        except Exception:
            await self.session.rollback()
            raise

    async def set_dataset(
        self,
        conversation_id: uuid.UUID,
        file_id: uuid.UUID,
    ) -> Conversation | None:
        conversation = await self.get_conversation(conversation_id)

        if conversation is None:
            return None

        file_record = await self.session.get(File, file_id)

        if file_record is None:
            raise ValueError("File not found.")

        conversation.dataset_id = file_id

        await self.session.commit()
        await self.session.refresh(conversation)

        return conversation

    async def remove_dataset(
        self,
        conversation_id: uuid.UUID,
    ) -> Conversation | None:
        conversation = await self.get_conversation(conversation_id)

        if conversation is None:
            return None

        conversation.dataset_id = None

        await self.session.commit()
        await self.session.refresh(conversation)

        return conversation

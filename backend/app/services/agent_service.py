import uuid

from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

from app.services.conversation_service import ConversationService


class AgentService:
    """Handles agent execution and conversation messaging."""

    def __init__(self, conversation_service, agent, dataset_service):
        self.conversation_service = conversation_service
        self.agent = agent
        self.dataset_service = dataset_service

    async def send_first_message(self, message: str) -> dict:
        """Create a conversation and process its first message."""

        conversation = await self.conversation_service.create_conversation(
            title=message[:255],
        )

        return await self._invoke_agent(
            conversation_id=conversation.id,
            dataset_id=None,
            message=message,
        )

    async def send_message(
        self,
        conversation_id: uuid.UUID,
        message: str,
    ) -> dict:
        """Continue an existing conversation."""

        conversation = await self.conversation_service.get_conversation(
            conversation_id
        )

        if conversation is None:
            raise ValueError("Conversation not found.")

        return await self._invoke_agent(
            conversation_id=conversation_id,
            dataset_id=conversation.dataset_id,
            message=message,
        )

    async def _invoke_agent(
        self,
        conversation_id: uuid.UUID,
        dataset_id: uuid.UUID | None,
        message: str,
    ) -> dict:
        """Invoke LangGraph and extract the agent response."""

        config = {
            "configurable": {
                "thread_id": str(conversation_id),
            }
        }

        await self._ensure_dataset_loaded(dataset_id)

        result = await self.agent.ainvoke(
            {
                "messages": [
                    HumanMessage(content=message)
                ],
                "dataset_id": str(dataset_id) if dataset_id else None
            },
            config=config,
        )

        response = self._extract_response(result["messages"])

        return {
            "conversation_id": conversation_id,
            "message": message,
            "response": response,
        }

    def _extract_response(self, messages) -> str:
        """Extract textual content from the final AI message."""

        for message in reversed(messages):
            if not isinstance(message, AIMessage):
                continue

            if message.tool_calls:
                continue

            content = message.content

            if isinstance(content, str):
                return content

            if isinstance(content, list):
                text_parts = [
                    block["text"]
                    for block in content
                    if isinstance(block, dict)
                    and block.get("type") == "text"
                ]
                return "\n".join(text_parts)

        return ""

    async def _ensure_dataset_loaded(self, dataset_id: uuid.UUID | None) -> None:
        if dataset_id is None:
            return

        dataset_id = str(dataset_id)

        try:
            self.dataset_service.dataset_registry.get(dataset_id)
        except ValueError:
            await self.dataset_service.load_dataset(uuid.UUID(dataset_id))

    def _extract_message_content(self, content) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            text_parts = [
                block["text"]
                for block in content
                if isinstance(block, dict)
                and block.get("type") == "text"
                and isinstance(block.get("text"), str)
            ]
            return "\n".join(text_parts)

        return ""

    async def get_message_history(self, conversation_id: uuid.UUID) -> list[dict]:
        conversation = await self.conversation_service.get_conversation(
            conversation_id
        )

        if conversation is None:
            raise ValueError("Conversation not found.")

        config = {
            "configurable": {
                "thread_id": str(conversation_id)
            }
        }

        state = await self.agent.aget_state(config)
        messages = state.values.get("messages", [])

        history = []

        for message in messages:
            if isinstance(message, HumanMessage):
                role = "user"
            elif isinstance(message, AIMessage) and not message.tool_calls:
                role = "assistant"
            elif isinstance(message, ToolMessage):
                role = "tool"
            else:
                continue

            history.append({
                "role": role,
                "content": self._extract_message_content(message.content),
            })

        return history

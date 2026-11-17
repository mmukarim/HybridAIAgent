import uuid

from langchain_core.messages import HumanMessage, AIMessage

from app.services.conversation_service import ConversationService


class AgentService:
    """Handles agent execution and conversation messaging."""

    def __init__(self, conversation_service, agent):
        self.conversation_service = conversation_service
        self.agent = agent

    async def send_first_message(self, message: str) -> dict:
        """Create a conversation and process its first message."""

        conversation = await self.conversation_service.create_conversation(
            title=message[:255],
        )

        return await self._invoke_agent(
            conversation_id=conversation.id,
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
            message=message,
        )

    async def _invoke_agent(
        self,
        conversation_id: uuid.UUID,
        message: str,
    ) -> dict:
        """Invoke LangGraph and extract the agent response."""

        config = {
            "configurable": {
                "thread_id": str(conversation_id),
            }
        }

        result = await self.agent.ainvoke(
            {
                "messages": [
                    HumanMessage(content=message)
                ]
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

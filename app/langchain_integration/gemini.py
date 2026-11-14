import json

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import settings


class GeminiChatModel:
    def __init__(self):
        self.model = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
        )

    def invoke(self, prompt: str):
        return self.model.invoke(prompt)

    def invoke_messages(self, messages: list[BaseMessage]):
        return self.model.invoke(messages)

    def bind_tools(self, tools):
        return self.model.bind_tools(tools)

from google import genai

from app.llm.base import LLMProvider
from app.config import settings


class GeminiLLM(LLMProvider):

    def __init__(self, model: str = None):
        self.client = genai.Client()
        self.model = model or settings.GEMINI_MODEL

    def generate(self, prompt: str) -> str:
        response = self.client.interactions.create(
            model=self.model,
            input=prompt
        )
        return response.output_text

    def create_interaction(self, input_data: str | list, tools: list, previous_interaction_id: str | None = None):
        response = self.client.interactions.create(
            model=self.model,
            input=input_data,
            tools=tools,
            previous_interaction_id=previous_interaction_id,
        )
        return response
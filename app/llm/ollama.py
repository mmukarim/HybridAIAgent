import ollama

from app.llm.base import LLMProvider
from app.config import settings


class OllamaLLM(LLMProvider):

    def __init__(self, client=None, model: str = None):
        self.client = client or ollama.Client(
            host=settings.OLLAMA_HOST
        )
        self.model = model or settings.OLLAMA_MODEL

    def generate(self, prompt: str) -> str:
        response = ollama.chat(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.message.content
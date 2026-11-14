from app.llm.base import LLMProvider
from app.llm.gemini import GeminiLLM
from app.llm.ollama import OllamaLLM


class LLMFactory:

    _providers = {
        "gemini": GeminiLLM,
        "ollama": OllamaLLM,
    }

    @classmethod
    def create(cls, provider: str) -> LLMProvider:
        provider = provider.strip().lower()
        provider_class = cls._providers.get(provider)
        if provider_class is None:
            raise ValueError(f"Unknown provider: {provider}")
        return provider_class()
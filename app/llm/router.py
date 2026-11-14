
from app.llm.base import LLMProvider
from app.llm.factory import LLMFactory


class HybridModelRouter:

    def __init__(self):
        # Initialize provider instances once
        self.providers: dict[str, LLMProvider] = {
            "gemini": LLMFactory.create("gemini"),
            "ollama": LLMFactory.create("ollama"),
        }

        # Define task-to-provider mapping
        self.routing_policy = {
            "simple": "ollama",
            "classification": "ollama",
            "local_only": "ollama",
            "complex": "gemini",
            "analysis": "gemini",
        }

    def select_provider(self, task_type: str) -> LLMProvider:
        # Normalize task type
        task_type = task_type.strip().lower()

        # Resolve provider name
        provider_name = self.routing_policy.get(task_type)

        if provider_name is None:
            raise ValueError(
                f"Unsupported task type: {task_type}"
            )

        # Return the provider instance
        return self.providers[provider_name]

    def generate(self, prompt: str, task_type: str) -> str:
        llm = self.select_provider(task_type)
        return llm.generate(prompt)

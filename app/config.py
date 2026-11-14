import os
from dotenv import load_dotenv

load_dotenv()

class Settings:

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:1.7b")
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")


settings = Settings()
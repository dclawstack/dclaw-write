from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "DClaw Write"
    app_env: str = "dev"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./dclaw_write.db"

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    ollama_embed_model: str = "nomic-embed-text"
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.1-8b-instruct"

    # Retrieval / grounding
    tavily_api_key: str = ""
    serper_api_key: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

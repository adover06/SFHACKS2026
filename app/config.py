import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ACTIAN_DB_ADDRESS: str = os.getenv("ACTIAN_DB_ADDRESS", "100.117.162.36:50051")
    COLLECTION_NAME: str = os.getenv("COLLECTION_NAME", "recipes")
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"
    USE_AGENT: bool = os.getenv("USE_AGENT", "false").lower() == "true"
    RELAXED_MATCHING: bool = os.getenv("RELAXED_MATCHING", "true").lower() == "true"

    # Local embedding model (sentence-transformers, runs on CPU/GPU)
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "all-mpnet-base-v2")
    EMBEDDING_DIMENSION: int = int(os.getenv("EMBEDDING_DIMENSION", "768"))


settings = Settings()

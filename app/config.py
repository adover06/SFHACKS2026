import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ACTIAN_DB_ADDRESS: str = os.getenv("ACTIAN_DB_ADDRESS", "localhost:50051")
    COLLECTION_NAME: str = os.getenv("COLLECTION_NAME", "recipes")
    EMBEDDING_DIMENSION: int = int(os.getenv("EMBEDDING_DIMENSION", "768"))
    GEMINI_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-004"


settings = Settings()

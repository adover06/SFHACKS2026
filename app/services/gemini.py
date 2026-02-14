from google import genai
from google.genai import types
import PIL.Image
import io

from app.config import settings
from app.models import PantryInventory


# ── Gemini Client ──

_client = genai.Client(api_key=settings.GEMINI_API_KEY)


# ── Image Analysis ──


def analyze_image(image_bytes: bytes) -> PantryInventory:
    """Use Gemini Vision to extract ingredients from a pantry/fridge image."""
    img = PIL.Image.open(io.BytesIO(image_bytes))

    response = _client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=[
            "Extract all visible food ingredients from this image. "
            "For each ingredient, provide the name, estimated quantity if visible, "
            "and your confidence score (0-1) that the item is correctly identified. "
            "Only include actual food items, not containers, appliances, or packaging.",
            img,
        ],
        config={
            "response_mime_type": "application/json",
            "response_schema": PantryInventory,
        },
    )

    return response.parsed


# ── Text Embeddings ──


def generate_embedding(text: str) -> list[float]:
    """Generate a 768-dim embedding vector using Gemini text-embedding-004."""
    result = _client.models.embed_content(
        model=settings.EMBEDDING_MODEL,
        contents=text,
    )
    return result.embeddings[0].values


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts."""
    result = _client.models.embed_content(
        model=settings.EMBEDDING_MODEL,
        contents=texts,
    )
    return [e.values for e in result.embeddings]

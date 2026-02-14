from google import genai
from google.genai import types
import PIL.Image
import io
import logging

from app.config import settings
from app.models import PantryInventory

logger = logging.getLogger(__name__)


# ── Gemini Client (for Vision only) ──

_client = genai.Client(api_key=settings.GEMINI_API_KEY)


# ── Local Embedding Model (sentence-transformers) ──

_embedder = None


def _get_embedder():
    """Lazy-load the sentence-transformers model.

    Loads on first call so the server starts fast.
    Uses GPU if available (CUDA), otherwise CPU.
    """
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        model_name = settings.EMBEDDING_MODEL_NAME
        logger.info(f"Loading embedding model: {model_name}")
        _embedder = SentenceTransformer(model_name)
        device = _embedder.device
        logger.info(f"Embedding model loaded on {device}")
    return _embedder


# ── Image Analysis (Gemini Vision) ──


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


# ── Text Embeddings (Local, sentence-transformers) ──


def generate_embedding(text: str) -> list[float]:
    """Generate an embedding vector using the local sentence-transformers model."""
    model = _get_embedder()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts using the local model.

    On GPU this is very fast (thousands per second).
    On CPU it's still fine for small batches.
    """
    model = _get_embedder()
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=128)
    return vectors.tolist()

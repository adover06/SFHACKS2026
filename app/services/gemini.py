from google import genai
from google.genai import types
import PIL.Image
import io
import time
import logging

from app.config import settings
from app.models import PantryInventory, RecipeList, UserPreferences

logger = logging.getLogger(__name__)

# Maximum retries for rate-limited or transient Gemini API errors
_MAX_RETRIES = 3
_BASE_BACKOFF = 2  # seconds


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


def _is_retryable(exc: Exception) -> bool:
    """Check if a Gemini API error is retryable (rate limit or transient)."""
    exc_str = str(exc).lower()
    # Rate limit (429) or server errors (500, 503)
    return any(code in exc_str for code in ["429", "resource_exhausted", "503", "500", "unavailable", "deadline"])


# ── Image Analysis (Gemini Vision) ──


def analyze_image(image_bytes: bytes) -> PantryInventory:
    """Use Gemini Vision to extract ingredients from a pantry/fridge image.

    Includes retry logic for rate-limited requests.
    """
    img = PIL.Image.open(io.BytesIO(image_bytes))

    for attempt in range(_MAX_RETRIES):
        try:
            t0 = time.time()
            logger.info(f"[analyze_image] Calling Gemini Vision (attempt {attempt + 1})…")
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
            elapsed = time.time() - t0
            logger.info(f"[analyze_image] Completed in {elapsed:.1f}s")
            return response.parsed

        except Exception as e:
            elapsed = time.time() - t0
            logger.warning(f"[analyze_image] Attempt {attempt + 1} failed after {elapsed:.1f}s: {e}")
            if attempt < _MAX_RETRIES - 1 and _is_retryable(e):
                wait = _BASE_BACKOFF * (2 ** attempt)
                logger.info(f"[analyze_image] Retrying in {wait}s…")
                time.sleep(wait)
            else:
                raise


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


# ── Recipe Generation (Direct LLM, no DB) ──


def generate_recipes(
    ingredients: list[str],
    preferences: UserPreferences,
    count: int = 5,
) -> list[dict]:
    """Generate recipes directly using Gemini, bypassing the vector DB.

    Includes retry logic for rate-limited requests.
    """
    prompt_parts = [
        f"You are a professional chef. Create exactly {count} detailed recipes that can be made using these ingredients: {', '.join(ingredients)}.",
        "You can assume basic pantry staples (oil, salt, pepper, etc.) are available.",
        "For each recipe, include a title, description, ingredients list, step-by-step directions, dietary tags, and skill level.",
        "Also estimate a 'match' percentage (0-100) based on how many of the provided ingredients are used.",
        "Assign a random integer ID to each recipe.",
    ]

    if preferences.dietary_restrictions:
        prompt_parts.append(f"Dietary restrictions: {', '.join(preferences.dietary_restrictions)}")
    if preferences.cuisine_preferences:
        prompt_parts.append(f"Cuisine preferences: {', '.join(preferences.cuisine_preferences)}")
    if preferences.allergies:
        prompt_parts.append(f"Allergies (MUST AVOID): {', '.join(preferences.allergies)}")
    if preferences.meal_type:
        prompt_parts.append(f"Meal type: {preferences.meal_type}")
    if preferences.skill_level:
        prompt_parts.append(f"Skill level target: {preferences.skill_level}")
    if preferences.additional_prompt:
        prompt_parts.append(f"Additional user request: {preferences.additional_prompt}")

    prompt = "\n".join(prompt_parts)

    for attempt in range(_MAX_RETRIES):
        try:
            t0 = time.time()
            logger.info(f"[generate_recipes] Calling Gemini (attempt {attempt + 1})…")
            response = _client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=[prompt],
                config={
                    "response_mime_type": "application/json",
                    "response_schema": RecipeList,
                },
            )
            elapsed = time.time() - t0
            logger.info(f"[generate_recipes] Completed in {elapsed:.1f}s")

            # Convert Pydantic models to dicts for consistency with the rest of the app
            return [r.model_dump() for r in response.parsed.recipes]

        except Exception as e:
            elapsed = time.time() - t0
            logger.warning(f"[generate_recipes] Attempt {attempt + 1} failed after {elapsed:.1f}s: {e}")
            if attempt < _MAX_RETRIES - 1 and _is_retryable(e):
                wait = _BASE_BACKOFF * (2 ** attempt)
                logger.info(f"[generate_recipes] Retrying in {wait}s…")
                time.sleep(wait)
            else:
                raise

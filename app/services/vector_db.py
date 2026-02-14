import sys
import os

# Add the Actian wheel's install location to the path so we can import cortex
_ACTIAN_VENV = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "actian-vectorAI-db-beta",
    "examples",
    "venv",
    "lib",
)
# Find the python3.X site-packages dir dynamically
if os.path.isdir(_ACTIAN_VENV):
    for entry in os.listdir(_ACTIAN_VENV):
        sp = os.path.join(_ACTIAN_VENV, entry, "site-packages")
        if os.path.isdir(sp) and sp not in sys.path:
            sys.path.insert(0, sp)

from cortex import CortexClient, DistanceMetric
from cortex.filters import Filter, Field

from app.config import settings


def get_client() -> CortexClient:
    """Create a new sync Cortex client."""
    return CortexClient(settings.ACTIAN_DB_ADDRESS)


def ensure_collection(client: CortexClient) -> None:
    """Create the recipes collection if it doesn't exist."""
    client.get_or_create_collection(
        name=settings.COLLECTION_NAME,
        dimension=settings.EMBEDDING_DIMENSION,
        distance_metric=DistanceMetric.COSINE,
    )


def upsert_recipe(
    client: CortexClient,
    recipe_id: int,
    vector: list[float],
    payload: dict,
) -> None:
    """Insert or update a single recipe vector."""
    client.upsert(
        collection_name=settings.COLLECTION_NAME,
        id=recipe_id,
        vector=vector,
        payload=payload,
    )


def batch_upsert_recipes(
    client: CortexClient,
    ids: list[int],
    vectors: list[list[float]],
    payloads: list[dict],
) -> None:
    """Batch insert recipe vectors."""
    client.batch_upsert(
        collection_name=settings.COLLECTION_NAME,
        ids=ids,
        vectors=vectors,
        payloads=payloads,
    )


def search_recipes(
    client: CortexClient,
    query_vector: list[float],
    top_k: int = 10,
    filter_obj: Filter | None = None,
) -> list[dict]:
    """Search for similar recipes by vector, optionally with filters.

    Returns a list of dicts with keys: id, score, payload.
    """
    kwargs = {
        "collection_name": settings.COLLECTION_NAME,
        "query": query_vector,
        "top_k": top_k,
        "with_payload": True,
    }
    if filter_obj and not filter_obj.is_empty():
        kwargs["filter"] = filter_obj

    results = client.search(**kwargs)
    return [{"id": r.id, "score": r.score, "payload": r.payload} for r in results]


def build_recipe_filter(
    dietary_restrictions: list[str] | None = None,
    skill_level: str | None = None,
) -> Filter:
    """Build a payload filter from user preferences.

    Dietary restrictions are matched against the auto-inferred dietary_tags
    stored in each recipe's payload. For example, if the user specifies
    'vegetarian', we filter for recipes tagged as vegetarian.

    Skill level filters for recipes at or below the requested level.
    """
    f = Filter()

    # Dietary restriction filtering:
    # Each recipe payload has dietary_tags like ["vegetarian", "gluten-free"].
    # If a user requests "vegetarian", we want recipes that have "vegetarian"
    # in their dietary_tags. Actian's filter DSL supports field equality,
    # so we filter on individual tag fields stored as booleans.
    if dietary_restrictions:
        for tag in dietary_restrictions:
            normalized = tag.lower().strip()
            f = f.must(Field(f"tag_{normalized}").eq(True))

    # Skill level filtering
    if skill_level:
        level_map = {"beginner": 4, "intermediate": 8, "advanced": 999}
        max_steps = level_map.get(skill_level.lower(), 999)
        f = f.must(Field("num_steps").lte(max_steps))

    return f


def get_collection_count(client: CortexClient) -> int:
    """Get the number of vectors in the recipes collection."""
    return client.count(settings.COLLECTION_NAME)

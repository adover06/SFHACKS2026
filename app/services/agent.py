"""
Treat Your-shelf recipe recommendation pipeline.

Two modes:
1. Direct pipeline (default) — image → Gemini Vision → embedding → Actian search.
   Uses only 2 Gemini API calls per request (1 vision + 1 embedding).
2. LangChain agent mode — lets Gemini orchestrate the tools. Uses 3-4+ API calls
   per request due to agent reasoning overhead.  Activate with USE_AGENT=true in .env.

The direct pipeline is recommended for free-tier Gemini keys (5 RPM limit on 2.5-flash).
"""

import json
import time
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool

from app.config import settings
from app.models import UserPreferences, RecipeResult
from app.services import gemini, vector_db

logger = logging.getLogger(__name__)


# ── Shared state for the current request (used by agent tools) ──
_current_image_bytes: bytes = b""
_current_preferences: UserPreferences = UserPreferences()


# ── Helpers ──


def _format_results(
    results: list[dict],
    ingredient_names: list[str],
) -> list[dict]:
    """Convert raw Actian search results into the frontend RecipeResult format."""
    recipes = []
    for r in results:
        payload = r.get("payload", {})
        score = r.get("score", 0)

        # Parse ingredients from payload
        raw_ingredients = payload.get("ingredients", [])
        if isinstance(raw_ingredients, str):
            try:
                raw_ingredients = json.loads(raw_ingredients)
            except json.JSONDecodeError:
                raw_ingredients = [raw_ingredients]

        # Calculate pantry match percentage
        recipe_ing_lower = [i.lower() for i in raw_ingredients]
        detected_lower = [i.lower() for i in ingredient_names]
        matches = sum(
            1 for d in detected_lower if any(d in ri for ri in recipe_ing_lower)
        )
        total_recipe_ings = max(len(raw_ingredients), 1)
        match_pct = min(int((matches / total_recipe_ings) * 100), 100)

        # Blend: 40% ingredient overlap + 60% vector similarity
        vector_match = int(score * 100)
        blended_match = int(0.4 * match_pct + 0.6 * vector_match)
        blended_match = min(max(blended_match, 0), 100)

        # Parse directions
        raw_directions = payload.get("directions", [])
        if isinstance(raw_directions, str):
            try:
                raw_directions = json.loads(raw_directions)
            except json.JSONDecodeError:
                raw_directions = [raw_directions]

        recipes.append(
            {
                "id": r.get("id", 0),
                "title": payload.get("title", "Unknown Recipe"),
                "match": blended_match,
                "ingredients": raw_ingredients,
                "description": payload.get("description", ""),
                "directions": raw_directions,
                "category": payload.get("category", ""),
                "dietary_tags": payload.get("dietary_tags", []),
                "skill_level": payload.get("skill_level", ""),
            }
        )

    recipes.sort(key=lambda x: x["match"], reverse=True)
    return recipes


def _search_with_preferences(
    ingredient_names: list[str],
    preferences: UserPreferences,
) -> list[dict]:
    """Build query, embed it, search Actian DB, return formatted recipes."""
    # Build query text
    query_parts = ["Ingredients: " + ", ".join(ingredient_names)]
    if preferences.cuisine_preferences:
        query_parts.append("Cuisine: " + ", ".join(preferences.cuisine_preferences))
    if preferences.meal_type:
        query_parts.append(f"Meal type: {preferences.meal_type}")
    if preferences.additional_prompt:
        query_parts.append(preferences.additional_prompt)

    query_text = ". ".join(query_parts)

    # Generate embedding (1 API call)
    query_vector = gemini.generate_embedding(query_text)

    # Build filters
    db_filter = vector_db.build_recipe_filter(
        dietary_restrictions=preferences.dietary_restrictions or None,
        skill_level=preferences.skill_level,
    )

    # Search Actian VectorAI DB
    client = vector_db.get_client()
    try:
        client.connect()
        results = vector_db.search_recipes(
            client,
            query_vector=query_vector,
            top_k=10,
            filter_obj=db_filter,
        )
    finally:
        client.close()

    return _format_results(results, ingredient_names)


# ── Direct Pipeline (default) ──


def run_direct_pipeline(
    image_bytes: bytes,
    preferences: UserPreferences,
) -> dict:
    """Run the direct pipeline: image → ingredients → recipes.

    Uses exactly 2 Gemini API calls: 1 vision + 1 embedding.
    No LangChain agent overhead.
    """
    # Step 1: Analyze image (1 Gemini API call)
    logger.info("Analyzing image with Gemini Vision...")
    inventory = gemini.analyze_image(image_bytes)
    ingredient_names = [ing.name for ing in inventory.ingredients]
    logger.info(f"Detected {len(ingredient_names)} ingredients: {ingredient_names}")

    if not ingredient_names:
        return {"detected_ingredients": [], "recipes": []}

    # Step 2: Search recipes (1 Gemini embedding call + Actian DB query)
    logger.info("Searching recipes in Actian VectorAI DB...")
    recipes = _search_with_preferences(ingredient_names, preferences)
    logger.info(f"Found {len(recipes)} matching recipes")

    return {
        "detected_ingredients": ingredient_names,
        "recipes": recipes,
    }


# ── LangChain Agent Mode (optional, set USE_AGENT=true) ──


@tool
def analyze_pantry_image(placeholder: str = "") -> str:
    """Analyze the uploaded pantry/fridge image and extract all visible
    food ingredients. Returns a JSON list of detected ingredients with
    names, quantities, and confidence scores."""
    global _current_image_bytes

    if not _current_image_bytes:
        return json.dumps({"error": "No image provided"})

    inventory = gemini.analyze_image(_current_image_bytes)
    ingredients = [
        {
            "name": ing.name,
            "quantity": ing.quantity,
            "confidence": ing.confidence,
        }
        for ing in inventory.ingredients
    ]
    return json.dumps({"ingredients": ingredients})


@tool
def search_recipes_tool(ingredients_json: str) -> str:
    """Search for recipes that match the detected ingredients and user
    preferences. Takes a JSON string containing a list of ingredient names.
    Returns matching recipes ranked by similarity.

    Args:
        ingredients_json: JSON string like '{"ingredients": ["chicken", "rice", "garlic"]}'
    """
    global _current_preferences

    try:
        data = json.loads(ingredients_json)
        if isinstance(data, dict):
            ingredient_names = [
                i["name"] if isinstance(i, dict) else i
                for i in data.get("ingredients", [])
            ]
        elif isinstance(data, list):
            ingredient_names = [i["name"] if isinstance(i, dict) else i for i in data]
        else:
            ingredient_names = []
    except (json.JSONDecodeError, KeyError):
        ingredient_names = []

    if not ingredient_names:
        return json.dumps({"error": "No ingredients provided to search"})

    recipes = _search_with_preferences(ingredient_names, _current_preferences)
    return json.dumps({"recipes": recipes})


SYSTEM_PROMPT = """You are a helpful recipe recommendation assistant for the "Treat Your-shelf" app.

Your job is to:
1. First, analyze the user's pantry/fridge image using the analyze_pantry_image tool to detect ingredients.
2. Then, search for matching recipes using the search_recipes_tool tool, passing the detected ingredients.
3. Return the final results.

Always call analyze_pantry_image first, then pass the results to search_recipes_tool.
Be concise and direct. Return the tool outputs without excessive commentary.
"""

PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]
)


def _create_agent() -> AgentExecutor:
    """Create a new LangChain agent with Gemini as the LLM backbone."""
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0,
    )

    tools = [analyze_pantry_image, search_recipes_tool]
    agent = create_tool_calling_agent(llm, tools, PROMPT)

    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=5,
    )


def run_agent_mode(
    image_bytes: bytes,
    preferences: UserPreferences,
) -> dict:
    """Run the LangChain agent pipeline. Uses 3-4+ Gemini API calls."""
    global _current_image_bytes, _current_preferences
    _current_image_bytes = image_bytes
    _current_preferences = preferences

    parts = [
        "I've uploaded a photo of my pantry/fridge. Please analyze it and find me recipes."
    ]
    if preferences.dietary_restrictions:
        parts.append(
            f"Dietary restrictions: {', '.join(preferences.dietary_restrictions)}"
        )
    if preferences.cuisine_preferences:
        parts.append(
            f"Cuisine preferences: {', '.join(preferences.cuisine_preferences)}"
        )
    if preferences.allergies:
        parts.append(f"Allergies (avoid these): {', '.join(preferences.allergies)}")
    if preferences.meal_type:
        parts.append(f"Meal type: {preferences.meal_type}")
    if preferences.skill_level:
        parts.append(f"Skill level: {preferences.skill_level}")
    if preferences.additional_prompt:
        parts.append(f"Additional request: {preferences.additional_prompt}")

    user_input = "\n".join(parts)

    executor = _create_agent()
    result = executor.invoke({"input": user_input})

    output_text = result.get("output", "")
    detected_ingredients = []
    recipes = []

    try:
        parsed = json.loads(output_text)
        if isinstance(parsed, dict):
            recipes = parsed.get("recipes", [])
            detected_ingredients = [
                i["name"] if isinstance(i, dict) else i
                for i in parsed.get("ingredients", [])
            ]
    except json.JSONDecodeError:
        pass

    # Fallback to direct pipeline if agent didn't return structured data
    if not recipes:
        return run_direct_pipeline(image_bytes, preferences)

    if not detected_ingredients:
        inventory = gemini.analyze_image(image_bytes)
        detected_ingredients = [ing.name for ing in inventory.ingredients]

    return {
        "detected_ingredients": detected_ingredients,
        "recipes": recipes,
    }


# ── Public Entry Point ──


def run_agent(
    image_bytes: bytes,
    preferences: UserPreferences,
) -> dict:
    """Run the recipe recommendation pipeline.

    Uses direct pipeline by default (2 API calls).
    Set USE_AGENT=true in .env to use the LangChain agent instead (3-4+ API calls).
    """
    use_agent = settings.USE_AGENT

    if use_agent:
        logger.info("Using LangChain agent mode")
        return run_agent_mode(image_bytes, preferences)
    else:
        logger.info("Using direct pipeline mode")
        return run_direct_pipeline(image_bytes, preferences)

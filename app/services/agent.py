"""
LangChain agent for the Treat Your-shelf recipe recommendation pipeline.

The agent has two tools:
1. analyze_pantry_image - Uses Gemini Vision to extract ingredients from an image
2. search_recipes - Embeds ingredients + preferences, queries Actian VectorAI DB

The agent orchestrates the pipeline: image -> ingredients -> vector search -> ranked recipes.
"""

import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool

from app.config import settings
from app.models import UserPreferences, RecipeResult
from app.services import gemini, vector_db


# ── Shared state for the current request ──
# The agent tools need access to the image bytes and preferences
# passed in from the FastAPI endpoint. We store them here per-invocation.
_current_image_bytes: bytes = b""
_current_preferences: UserPreferences = UserPreferences()


# ── Tools ──


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
def search_recipes(ingredients_json: str) -> str:
    """Search for recipes that match the detected ingredients and user
    preferences. Takes a JSON string containing a list of ingredient names.
    Returns matching recipes ranked by similarity.

    Args:
        ingredients_json: JSON string like '{"ingredients": ["chicken", "rice", "garlic"]}'
    """
    global _current_preferences

    # Parse ingredients
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

    # Build the search query text from ingredients + preferences
    query_parts = ["Ingredients: " + ", ".join(ingredient_names)]

    if _current_preferences.cuisine_preferences:
        query_parts.append(
            "Cuisine: " + ", ".join(_current_preferences.cuisine_preferences)
        )
    if _current_preferences.meal_type:
        query_parts.append(f"Meal type: {_current_preferences.meal_type}")
    if _current_preferences.additional_prompt:
        query_parts.append(_current_preferences.additional_prompt)

    query_text = ". ".join(query_parts)

    # Generate embedding for the search query
    query_vector = gemini.generate_embedding(query_text)

    # Build filters from preferences
    db_filter = vector_db.build_recipe_filter(
        dietary_restrictions=_current_preferences.dietary_restrictions or None,
        skill_level=_current_preferences.skill_level,
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

    # Format results
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
        # Count how many detected ingredients appear in the recipe
        recipe_ing_lower = [i.lower() for i in raw_ingredients]
        detected_lower = [i.lower() for i in ingredient_names]
        matches = sum(
            1 for d in detected_lower if any(d in ri for ri in recipe_ing_lower)
        )
        total_recipe_ings = max(len(raw_ingredients), 1)
        match_pct = min(int((matches / total_recipe_ings) * 100), 100)

        # Boost match percentage by vector similarity score
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

    # Sort by match score descending
    recipes.sort(key=lambda x: x["match"], reverse=True)

    return json.dumps({"recipes": recipes})


# ── Agent Setup ──

SYSTEM_PROMPT = """You are a helpful recipe recommendation assistant for the "Treat Your-shelf" app.

Your job is to:
1. First, analyze the user's pantry/fridge image using the analyze_pantry_image tool to detect ingredients.
2. Then, search for matching recipes using the search_recipes tool, passing the detected ingredients.
3. Return the final results.

Always call analyze_pantry_image first, then pass the results to search_recipes.
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

    tools = [analyze_pantry_image, search_recipes]
    agent = create_tool_calling_agent(llm, tools, PROMPT)

    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=5,
    )


def run_agent(
    image_bytes: bytes,
    preferences: UserPreferences,
) -> dict:
    """Run the recipe recommendation agent.

    Args:
        image_bytes: Raw bytes of the pantry/fridge image.
        preferences: User's dietary and cuisine preferences.

    Returns:
        Dict with 'detected_ingredients' and 'recipes' keys.
    """
    global _current_image_bytes, _current_preferences
    _current_image_bytes = image_bytes
    _current_preferences = preferences

    # Build the user message
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

    # Run the agent
    executor = _create_agent()
    result = executor.invoke({"input": user_input})

    # Parse out the structured data from the agent's tool calls
    # The agent output will contain the search_recipes result
    output_text = result.get("output", "")

    # Try to extract structured data
    detected_ingredients = []
    recipes = []

    # The agent stores intermediate results; parse from tool outputs
    try:
        # Try parsing the output as JSON first
        parsed = json.loads(output_text)
        if isinstance(parsed, dict):
            recipes = parsed.get("recipes", [])
            detected_ingredients = [
                i["name"] if isinstance(i, dict) else i
                for i in parsed.get("ingredients", [])
            ]
    except json.JSONDecodeError:
        pass

    # If we couldn't get structured data from output, run tools directly as fallback
    if not recipes:
        # Direct pipeline fallback (no agent overhead)
        inventory = gemini.analyze_image(image_bytes)
        detected_ingredients = [ing.name for ing in inventory.ingredients]

        if detected_ingredients:
            search_input = json.dumps({"ingredients": detected_ingredients})
            search_result = search_recipes.invoke(search_input)
            try:
                search_data = json.loads(search_result)
                recipes = search_data.get("recipes", [])
            except json.JSONDecodeError:
                pass
    elif not detected_ingredients:
        # We got recipes but missed ingredients - extract from agent steps
        inventory = gemini.analyze_image(image_bytes)
        detected_ingredients = [ing.name for ing in inventory.ingredients]

    return {
        "detected_ingredients": detected_ingredients,
        "recipes": recipes,
    }

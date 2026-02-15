"""
Treat Your-shelf Backend API

FastAPI server that receives a pantry/fridge image + user preferences,
runs the LangChain agent pipeline (Gemini Vision -> Actian VectorAI DB),
and returns personalized recipe recommendations.

Usage:
    cd backend
    uvicorn app.main:app --reload --port 8000
"""

import json
import time
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import UserPreferences, ScanResponse, RecipeResult
from app.services.agent import run_agent

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Treat Your-shelf API",
    description="Snap a photo of your pantry, get personalized recipe recommendations.",
    version="1.0.0",
)

# CORS — allow all origins during development so Tailscale / ngrok / etc. work.
# For production, lock this down to specific domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Treat Your-shelf API is running", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# NOTE: This is intentionally a regular `def` (not `async def`) so that
# FastAPI automatically runs it in a thread-pool.  The Gemini SDK calls
# inside run_agent() are synchronous and would block the event loop if
# this were declared as `async def`.
@app.post("/api/scan", response_model=ScanResponse)
def scan_pantry(
    image: UploadFile = File(..., description="Photo of pantry or fridge"),
    preferences: str = Form(
        default="{}",
        description="JSON string of user preferences (dietary_restrictions, cuisine_preferences, etc.)",
    ),
):
    """Scan a pantry/fridge image and return personalized recipe recommendations.

    The image is sent as multipart/form-data along with a JSON string of preferences.

    Frontend example:
    ```js
    const formData = new FormData();
    formData.append("image", fileBlob);
    formData.append("preferences", JSON.stringify({
        dietary_restrictions: ["vegetarian"],
        cuisine_preferences: ["italian"],
        allergies: ["peanuts"],
        meal_type: "dinner",
        skill_level: "beginner",
        additional_prompt: "something quick"
    }));

    const res = await fetch("http://localhost:8000/api/scan", {
        method: "POST",
        body: formData,
    });
    const data = await res.json();
    ```
    """
    # Validate image
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"File must be an image. Got: {image.content_type}",
        )

    # Read image bytes
    image_bytes = image.file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")

    # Parse preferences JSON
    try:
        prefs_dict = json.loads(preferences)
        user_prefs = UserPreferences(**prefs_dict)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid preferences JSON: {e}",
        )

    # Run the agent pipeline
    try:
        start = time.time()
        logger.info("Starting recipe pipeline…")
        result = run_agent(image_bytes, user_prefs)
        elapsed = time.time() - start
        logger.info(f"Pipeline finished in {elapsed:.1f}s")
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        logger.error(f"Pipeline failed:\n{tb_str}")
        raise HTTPException(
            status_code=500,
            detail=f"Recipe search failed: {e}\nTraceback:\n{tb_str}",
        )

    # Build response
    recipes = [
        RecipeResult(**r) if isinstance(r, dict) else r
        for r in result.get("recipes", [])
    ]

    return ScanResponse(
        detected_ingredients=result.get("detected_ingredients", []),
        recipes=recipes,
    )

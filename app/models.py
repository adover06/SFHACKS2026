from pydantic import BaseModel, Field
from typing import Optional


# ── Request Models ──


class UserPreferences(BaseModel):
    dietary_restrictions: list[str] = Field(
        default_factory=list,
        description="e.g. vegetarian, vegan, gluten-free, keto, halal, kosher, paleo",
    )
    cuisine_preferences: list[str] = Field(
        default_factory=list,
        description="e.g. italian, mexican, indian, japanese, asian",
    )
    allergies: list[str] = Field(
        default_factory=list,
        description="e.g. peanuts, dairy, shellfish, soy, tree nuts, eggs",
    )
    meal_type: Optional[str] = Field(
        default=None,
        description="breakfast, lunch, dinner, snack, dessert",
    )
    skill_level: Optional[str] = Field(
        default=None,
        description="beginner, intermediate, advanced",
    )
    additional_prompt: Optional[str] = Field(
        default=None,
        description="Free-text from user, e.g. 'make it spicy' or 'something quick'",
    )


# ── Gemini Vision Models ──


class DetectedIngredient(BaseModel):
    name: str
    quantity: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)


class PantryInventory(BaseModel):
    ingredients: list[DetectedIngredient]


# ── Response Models ──


class RecipeResult(BaseModel):
    id: int
    title: str
    match: int = Field(ge=0, le=100, description="Pantry match percentage")
    ingredients: list[str]
    description: Optional[str] = None
    directions: list[str] = Field(default_factory=list)
    category: Optional[str] = None
    dietary_tags: list[str] = Field(default_factory=list)
    skill_level: Optional[str] = None


class ScanResponse(BaseModel):
    detected_ingredients: list[str]
    recipes: list[RecipeResult]

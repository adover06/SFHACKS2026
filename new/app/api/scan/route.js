import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * POST /api/scan
 *
 * Accepts multipart/form-data with:
 *   - image: File (pantry/fridge photo)
 *   - preferences: JSON string of user preferences
 *
 * Returns: { detected_ingredients: string[], recipes: RecipeResult[] }
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image");
    const prefsRaw = formData.get("preferences") || "{}";

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Parse preferences
    let preferences = {};
    try {
      preferences = JSON.parse(prefsRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid preferences JSON" },
        { status: 400 }
      );
    }

    // Convert image to base64 for Gemini
    const imageBytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBytes).toString("base64");
    const mimeType = imageFile.type || "image/jpeg";

    // Step 1: Detect ingredients with Gemini Vision
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const ingredientResult = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
      `Analyze this pantry/fridge image. Extract all visible food ingredients.
Return ONLY a JSON array of ingredient name strings, nothing else.
Example: ["chicken breast", "rice", "garlic", "olive oil", "bell pepper"]
Only include actual food items, not containers, appliances, or packaging.`,
    ]);

    const ingredientText = ingredientResult.response.text().trim();
    let detectedIngredients = [];
    try {
      // Strip markdown code fences if present
      const cleaned = ingredientText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      detectedIngredients = JSON.parse(cleaned);
    } catch {
      // Fallback: try to extract ingredients from text
      detectedIngredients = ingredientText
        .split(/[,\n]/)
        .map((s) => s.replace(/^[-•*"\s]+|["\s]+$/g, "").trim())
        .filter((s) => s.length > 0 && s.length < 50);
    }

    if (detectedIngredients.length === 0) {
      return NextResponse.json({
        detected_ingredients: [],
        recipes: [],
      });
    }

    // Step 2: Generate recipes with Gemini based on ingredients + preferences
    const prefParts = [];
    if (preferences.dietary_restrictions?.length > 0) {
      prefParts.push(
        `Dietary restrictions: ${preferences.dietary_restrictions.join(", ")}`
      );
    }
    if (preferences.allergies?.length > 0) {
      prefParts.push(
        `Allergies (MUST avoid): ${preferences.allergies.join(", ")}`
      );
    }
    if (preferences.cuisine_preferences?.length > 0) {
      prefParts.push(
        `Preferred cuisines: ${preferences.cuisine_preferences.join(", ")}`
      );
    }
    if (preferences.meal_type) {
      prefParts.push(`Meal type: ${preferences.meal_type}`);
    }
    if (preferences.skill_level) {
      prefParts.push(`Cooking skill level: ${preferences.skill_level}`);
    }
    if (preferences.additional_prompt) {
      prefParts.push(`Additional request: ${preferences.additional_prompt}`);
    }

    const prefString =
      prefParts.length > 0
        ? `\n\nUser preferences:\n${prefParts.join("\n")}`
        : "";

    const recipePrompt = `You are a recipe recommendation engine. Based on the available ingredients from a user's pantry, suggest 5-8 recipes they can make.

Available ingredients: ${detectedIngredients.join(", ")}${prefString}

Return ONLY valid JSON (no markdown fences) as an array of recipe objects with this exact structure:
[
  {
    "id": 1,
    "title": "Recipe Name",
    "match": 85,
    "ingredients": ["ingredient 1", "ingredient 2"],
    "description": "Brief 1-2 sentence description",
    "directions": ["Step 1...", "Step 2..."],
    "category": "Dinner",
    "dietary_tags": ["vegetarian", "gluten-free"],
    "skill_level": "beginner"
  }
]

Rules:
- "match" is a percentage (0-100) of how well the recipe matches the available pantry ingredients. Higher = more ingredients available.
- Prioritize recipes that use MOSTLY ingredients from the pantry list.
- Include the full ingredient list for each recipe (even ingredients not in the pantry).
- "directions" should be clear, numbered cooking steps.
- "dietary_tags" should be accurate based on ingredients (e.g. "vegetarian", "vegan", "gluten-free", "dairy-free").
- "skill_level" should be "beginner", "intermediate", or "advanced".
- "category" should be like "Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Side Dish", etc.
- Sort recipes by match percentage (highest first).
- Respect all dietary restrictions and allergies — never suggest recipes containing allergens.`;

    const recipeResult = await model.generateContent(recipePrompt);
    const recipeText = recipeResult.response.text().trim();

    let recipes = [];
    try {
      const cleaned = recipeText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      recipes = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse recipe JSON:", recipeText);
      recipes = [];
    }

    return NextResponse.json({
      detected_ingredients: detectedIngredients,
      recipes,
    });
  } catch (error) {
    console.error("Scan API error:", error);
    return NextResponse.json(
      { error: `Recipe search failed: ${error.message}` },
      { status: 500 }
    );
  }
}

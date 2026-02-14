#!/usr/bin/env python3
"""
Recipe Ingestion Script for Treat Your-shelf

Reads the Kaggle recipe JSON dataset, auto-infers dietary tags and skill level,
generates embeddings via Gemini text-embedding-004, and upserts everything into
the Actian VectorAI DB.

Usage:
    cd backend
    python -m scripts.ingest_recipes [--limit N] [--batch-size N]
"""

import json
import sys
import os
import time
import argparse
import numpy as np

# Add backend to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.services import gemini, vector_db


# ── Dietary Tag Inference ──

MEAT_KEYWORDS = {
    "chicken",
    "beef",
    "pork",
    "lamb",
    "turkey",
    "bacon",
    "sausage",
    "salami",
    "prosciutto",
    "pepperoni",
    "ham",
    "steak",
    "veal",
    "duck",
    "goose",
    "venison",
    "bison",
    "rabbit",
    "ground beef",
    "ground turkey",
    "ground pork",
    "ground chicken",
    "chuck",
    "sirloin",
    "tenderloin",
    "rib",
    "brisket",
}

SEAFOOD_KEYWORDS = {
    "shrimp",
    "salmon",
    "fish",
    "tuna",
    "cod",
    "tilapia",
    "crab",
    "lobster",
    "clam",
    "mussel",
    "oyster",
    "scallop",
    "anchovy",
    "anchovies",
    "sardine",
    "trout",
    "halibut",
    "mahi",
    "swordfish",
    "calamari",
    "squid",
    "octopus",
    "prawn",
    "crawfish",
    "crayfish",
}

DAIRY_KEYWORDS = {
    "milk",
    "cream",
    "butter",
    "cheese",
    "yogurt",
    "yoghurt",
    "sour cream",
    "cream cheese",
    "whey",
    "ghee",
    "casein",
    "half-and-half",
    "half and half",
    "ricotta",
    "mozzarella",
    "parmesan",
    "cheddar",
    "provolone",
    "feta",
    "brie",
    "gouda",
    "gruyere",
    "mascarpone",
    "cottage cheese",
    "whipped cream",
    "heavy cream",
    "ice cream",
}

EGG_KEYWORDS = {"egg", "eggs", "egg white", "egg yolk", "mayonnaise", "mayo"}

GLUTEN_KEYWORDS = {
    "flour",
    "bread",
    "pasta",
    "noodle",
    "noodles",
    "spaghetti",
    "macaroni",
    "penne",
    "fettuccine",
    "linguine",
    "lasagna",
    "tortilla",
    "wrap",
    "pita",
    "baguette",
    "croissant",
    "breadcrumb",
    "breadcrumbs",
    "panko",
    "crouton",
    "croutons",
    "soy sauce",
    "barley",
    "rye",
    "wheat",
    "couscous",
    "orzo",
    "muffin",
    "cake",
    "cookie",
    "biscuit",
    "cracker",
    "pretzel",
    "bagel",
    "roll",
    "bun",
    "pie crust",
    "pastry",
    "phyllo",
    "wonton",
    "manicotti",
    "ravioli",
    "tortellini",
}

NUT_KEYWORDS = {
    "peanut",
    "peanuts",
    "peanut butter",
    "almond",
    "almonds",
    "walnut",
    "walnuts",
    "cashew",
    "cashews",
    "pecan",
    "pecans",
    "pistachio",
    "pistachios",
    "macadamia",
    "hazelnut",
    "hazelnuts",
    "pine nut",
    "pine nuts",
    "brazil nut",
}

SHELLFISH_KEYWORDS = {
    "shrimp",
    "crab",
    "lobster",
    "clam",
    "clams",
    "mussel",
    "mussels",
    "oyster",
    "oysters",
    "scallop",
    "scallops",
    "crawfish",
    "crayfish",
    "prawn",
    "prawns",
}


def _text_contains_any(text: str, keywords: set[str]) -> bool:
    """Check if lowercased text contains any of the keywords."""
    for kw in keywords:
        if kw in text:
            return True
    return False


def infer_dietary_tags(ingredients: list[str]) -> dict:
    """Auto-infer dietary tags from ingredient list.

    Returns a dict with both the tag list and individual boolean flags
    (for Actian payload filtering).
    """
    text = " ".join(ingredients).lower()

    has_meat = _text_contains_any(text, MEAT_KEYWORDS)
    has_seafood = _text_contains_any(text, SEAFOOD_KEYWORDS)
    has_dairy = _text_contains_any(text, DAIRY_KEYWORDS)
    has_eggs = _text_contains_any(text, EGG_KEYWORDS)
    has_gluten = _text_contains_any(text, GLUTEN_KEYWORDS)
    has_nuts = _text_contains_any(text, NUT_KEYWORDS)
    has_shellfish = _text_contains_any(text, SHELLFISH_KEYWORDS)

    tags = []

    if not has_meat and not has_seafood:
        tags.append("vegetarian")
    if not has_meat and not has_seafood and not has_dairy and not has_eggs:
        tags.append("vegan")
    if not has_gluten:
        tags.append("gluten-free")
    if not has_dairy:
        tags.append("dairy-free")
    if not has_nuts:
        tags.append("nut-free")
    if not has_shellfish:
        tags.append("shellfish-free")

    return {
        "dietary_tags": tags,
        # Boolean flags for Actian payload filtering
        "tag_vegetarian": "vegetarian" in tags,
        "tag_vegan": "vegan" in tags,
        "tag_gluten-free": "gluten-free" in tags,
        "tag_dairy-free": "dairy-free" in tags,
        "tag_nut-free": "nut-free" in tags,
        "tag_shellfish-free": "shellfish-free" in tags,
    }


def infer_skill_level(num_steps: int) -> str:
    """Infer skill level from number of recipe steps."""
    if num_steps <= 4:
        return "beginner"
    elif num_steps <= 8:
        return "intermediate"
    else:
        return "advanced"


# ── Embedding Text Builder ──


def build_embedding_text(recipe: dict) -> str:
    """Build a rich text string for embedding from a recipe dict."""
    parts = []

    title = recipe.get("recipe_title", "")
    if title:
        parts.append(title)

    description = recipe.get("description", "")
    if description:
        parts.append(description)

    ingredients = recipe.get("ingredients", [])
    if ingredients:
        # Strip quantities, keep just the food item names for better matching
        parts.append("Ingredients: " + ", ".join(ingredients))

    category = recipe.get("category", "")
    if category:
        parts.append(f"Category: {category}")

    return ". ".join(parts)


# ── Main Ingestion ──


def ingest(
    data_path: str,
    limit: int | None = None,
    batch_size: int = 50,
    embedding_batch_size: int = 100,
    mode: str = "full",
    embeddings_file: str | None = None,
) -> None:
    """Ingest recipes from JSON file into Actian VectorAI DB.

    Modes:
      - 'full': Generate embeddings and insert into DB (default)
      - 'generate': Only generate embeddings, save to file
      - 'insert': Load embeddings from file, insert into DB
    """

    print(f"Reading recipes from {data_path}...")

    # Read all recipes
    recipes = []
    with open(data_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            try:
                recipe = json.loads(line)
                recipes.append(recipe)
            except json.JSONDecodeError as e:
                print(f"  Skipping line {line_num + 1}: {e}")
                continue

            if limit and len(recipes) >= limit:
                break

    total = len(recipes)
    print(f"Loaded {total} recipes.")

    # Build all payloads upfront (needed for all modes)
    all_payloads = []
    all_embedding_texts = []
    for recipe in recipes:
        ingredients = recipe.get("ingredients", [])
        num_steps = recipe.get("num_steps", 0)

        tag_info = infer_dietary_tags(ingredients)
        skill = infer_skill_level(num_steps)

        payload = {
            "title": recipe.get("recipe_title", ""),
            "description": recipe.get("description", ""),
            "ingredients": ingredients,
            "directions": recipe.get("directions", []),
            "category": recipe.get("category", ""),
            "subcategory": recipe.get("subcategory", ""),
            "num_ingredients": recipe.get("num_ingredients", len(ingredients)),
            "num_steps": num_steps,
            "skill_level": skill,
            **tag_info,
        }
        all_payloads.append(payload)
        all_embedding_texts.append(build_embedding_text(recipe))

    # === MODE: generate ===
    if mode == "generate":
        output_file = embeddings_file or os.path.join(
            os.path.dirname(data_path), "recipe_embeddings.npz"
        )
        print(f"\nGenerating embeddings (this will take a while on CPU)...")

        all_vectors = []
        for i in range(0, total, embedding_batch_size):
            batch_texts = all_embedding_texts[i : i + embedding_batch_size]
            vectors = gemini.generate_embeddings_batch(batch_texts)
            all_vectors.extend(vectors)
            print(
                f"  Progress: {min(i + embedding_batch_size, total)}/{total}", end="\r"
            )
            time.sleep(0.5)  # Rate limit buffer

        # Save to file
        vectors_array = np.array(all_vectors, dtype=np.float32)
        np.savez_compressed(output_file, vectors=vectors_array)
        print(f"\n\nSaved {total} embeddings to {output_file}")
        print(f"  Shape: {vectors_array.shape}")
        print(f"  File size: {os.path.getsize(output_file) / 1e6:.1f} MB")
        return

    # === MODE: insert ===
    if mode == "insert":
        input_file = embeddings_file or os.path.join(
            os.path.dirname(data_path), "recipe_embeddings.npz"
        )
        print(f"\nLoading embeddings from {input_file}...")
        data = np.load(input_file)
        all_vectors = data["vectors"]
        print(f"  Loaded {len(all_vectors)} vectors, shape: {all_vectors.shape}")

        print(f"Connecting to Actian VectorAI DB at {settings.ACTIAN_DB_ADDRESS}...")
        client = vector_db.get_client()
        client.connect()

        try:
            vector_db.ensure_collection(client)

            processed = 0
            for i in range(0, total, batch_size):
                batch_ids = list(range(i, min(i + batch_size, total)))
                batch_vectors = [all_vectors[j].tolist() for j in batch_ids]
                batch_payloads = [all_payloads[j] for j in batch_ids]

                try:
                    vector_db.batch_upsert_recipes(
                        client, batch_ids, batch_vectors, batch_payloads
                    )
                except Exception as e:
                    print(f"\n  Error upserting batch: {e}")
                    for j, (rid, vec, pay) in enumerate(
                        zip(batch_ids, batch_vectors, batch_payloads)
                    ):
                        try:
                            vector_db.upsert_recipe(client, rid, vec, pay)
                        except Exception as e2:
                            print(f"    Failed recipe {rid}: {e2}")

                processed += len(batch_ids)
                pct = (processed / total) * 100
                print(
                    f"  Progress: {processed}/{total} ({pct:.1f}%) ",
                    end="\r",
                )

            print(f"\n\nInsertion complete! {processed} recipes inserted.")
            count = vector_db.get_collection_count(client)
            print(f"Collection '{settings.COLLECTION_NAME}' now has {count} vectors.")

        finally:
            client.close()
        return

    # === MODE: full (original behavior) ===
    print(f"Connecting to Actian VectorAI DB at {settings.ACTIAN_DB_ADDRESS}...")
    client = vector_db.get_client()
    client.connect()

    try:
        # Ensure collection exists
        print(
            f"Ensuring collection '{settings.COLLECTION_NAME}' exists "
            f"(dim={settings.EMBEDDING_DIMENSION})..."
        )
        vector_db.ensure_collection(client)

        # Process in batches
        processed = 0
        batch_ids = []
        batch_vectors = []
        batch_payloads = []

        # Accumulate texts for embedding batches
        embedding_texts = []
        embedding_indices = []  # Track which recipe index each text belongs to

        print(
            f"\nStarting ingestion (batch_size={batch_size}, "
            f"embedding_batch={embedding_batch_size})...\n"
        )

        for i, recipe in enumerate(recipes):
            # Build payload with auto-inferred tags
            ingredients = recipe.get("ingredients", [])
            num_steps = recipe.get("num_steps", 0)

            tag_info = infer_dietary_tags(ingredients)
            skill = infer_skill_level(num_steps)

            payload = {
                "title": recipe.get("recipe_title", ""),
                "description": recipe.get("description", ""),
                "ingredients": ingredients,
                "directions": recipe.get("directions", []),
                "category": recipe.get("category", ""),
                "subcategory": recipe.get("subcategory", ""),
                "num_ingredients": recipe.get("num_ingredients", len(ingredients)),
                "num_steps": num_steps,
                "skill_level": skill,
                **tag_info,
            }

            # Build text for embedding
            embed_text = build_embedding_text(recipe)
            embedding_texts.append(embed_text)
            embedding_indices.append(i)

            batch_ids.append(i)
            batch_payloads.append(payload)

            # When we have enough texts, generate embeddings in batch
            if len(embedding_texts) >= embedding_batch_size or i == total - 1:
                # Generate embeddings
                try:
                    vectors = gemini.generate_embeddings_batch(embedding_texts)
                except Exception as e:
                    # Rate limit handling: wait and retry
                    print(f"\n  Rate limited, waiting 60s... ({e})")
                    time.sleep(60)
                    vectors = gemini.generate_embeddings_batch(embedding_texts)

                batch_vectors.extend(vectors)
                embedding_texts = []
                embedding_indices = []

                # Small delay to respect rate limits
                time.sleep(0.5)

            # When batch is full, upsert to DB
            if len(batch_ids) >= batch_size or i == total - 1:
                if batch_ids and len(batch_vectors) >= len(batch_ids):
                    # Take only the vectors for this batch
                    current_vectors = batch_vectors[: len(batch_ids)]
                    batch_vectors = batch_vectors[len(batch_ids) :]

                    try:
                        vector_db.batch_upsert_recipes(
                            client, batch_ids, current_vectors, batch_payloads
                        )
                    except Exception as e:
                        print(f"\n  Error upserting batch: {e}")
                        # Try individual upserts as fallback
                        for j, (rid, vec, pay) in enumerate(
                            zip(batch_ids, current_vectors, batch_payloads)
                        ):
                            try:
                                vector_db.upsert_recipe(client, rid, vec, pay)
                            except Exception as e2:
                                print(f"    Failed recipe {rid}: {e2}")

                    processed += len(batch_ids)
                    pct = (processed / total) * 100
                    print(
                        f"  Progress: {processed}/{total} ({pct:.1f}%) "
                        f"- Last: {batch_payloads[-1]['title'][:50]}",
                        end="\r",
                    )

                    batch_ids = []
                    batch_payloads = []

        print(f"\n\nIngestion complete! {processed} recipes inserted.")

        # Verify
        count = vector_db.get_collection_count(client)
        print(f"Collection '{settings.COLLECTION_NAME}' now has {count} vectors.")

    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingest recipes into Actian VectorAI DB"
    )
    parser.add_argument(
        "--data",
        type=str,
        default=os.path.join(
            os.path.dirname(__file__), "..", "data", "2_Recipe_json.json"
        ),
        help="Path to the recipe JSON file",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of recipes to ingest (default: all)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Number of recipes per DB upsert batch (default: 50)",
    )
    parser.add_argument(
        "--embedding-batch-size",
        type=int,
        default=100,
        help="Number of texts per embedding API call (default: 100)",
    )

    args = parser.parse_args()
    ingest(
        data_path=args.data,
        limit=args.limit,
        batch_size=args.batch_size,
        embedding_batch_size=args.embedding_batch_size,
    )

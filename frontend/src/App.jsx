import { useState, useRef, useEffect } from "react";
import {
  Camera,
  Leaf,
  ScanLine,
  ChefHat,
  ArrowLeft,
  Sparkles,
  UtensilsCrossed,
  Check,
  Upload,
} from "lucide-react";

/* ───── mock recipe data ───── */
const MOCK_RECIPES = [
  {
    id: 1,
    title: "Garden Veggie Stir-Fry",
    match: 92,
    ingredients: ["Bell pepper", "Broccoli", "Soy sauce", "Garlic", "Rice"],
  },
  {
    id: 2,
    title: "Hearty Lentil Soup",
    match: 85,
    ingredients: ["Lentils", "Carrots", "Onion", "Celery", "Tomato paste"],
  },
  {
    id: 3,
    title: "Creamy Pasta Primavera",
    match: 78,
    ingredients: ["Pasta", "Zucchini", "Cream", "Parmesan", "Basil"],
  },
  {
    id: 4,
    title: "Black Bean Tacos",
    match: 73,
    ingredients: ["Black beans", "Tortillas", "Avocado", "Lime", "Cilantro"],
  },
  {
    id: 5,
    title: "Banana Oat Pancakes",
    match: 68,
    ingredients: ["Banana", "Oats", "Egg", "Cinnamon", "Maple syrup"],
  },
];

/* ───── Home Screen ───── */
function HomeScreen({ onScan }) {
  return (
    <div className="flex flex-col items-center justify-between min-h-dvh px-6 py-12">
      {/* decorative top icon */}
      <div />

      {/* hero */}
      <div className="flex flex-col items-center gap-4 animate-fade-in-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--sage-200)" }}>
          <Leaf size={40} style={{ color: "var(--sage-600)" }} />
        </div>
        <h1
          className="text-4xl sm:text-5xl font-extrabold text-center leading-tight"
          style={{ color: "var(--sage-800)" }}
        >
          Treat Your‑shelf
        </h1>
        <p className="text-center max-w-xs" style={{ color: "var(--sage-600)" }}>
          Snap a photo of your pantry and let AI find delicious, healthy recipes
          for you.
        </p>
      </div>

      {/* scan button */}
      <button
        onClick={onScan}
        className="w-full max-w-xs flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg active:scale-[.97] transition-transform"
        style={{ backgroundColor: "var(--sage-500)" }}
      >
        <Camera size={24} />
        Scan My Pantry
      </button>
    </div>
  );
}

/* ───── Camera Screen ───── */
function CameraScreen({ onCapture, onBack }) {
  const inputRef = useRef(null);
  const uploadRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onCapture(file, url);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 gap-8 animate-fade-in-up">
      {/* back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 p-2 rounded-xl"
        style={{ backgroundColor: "var(--sage-100)" }}
      >
        <ArrowLeft size={22} style={{ color: "var(--sage-700)" }} />
      </button>

      <div
        className="w-36 h-36 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--sage-100)" }}
      >
        <ScanLine size={56} style={{ color: "var(--sage-500)" }} />
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--sage-800)" }}>
          Capture Your Pantry
        </h2>
        <p className="text-sm" style={{ color: "var(--sage-600)" }}>
          Take a photo or upload an image of your fridge or shelf
        </p>
      </div>

      {/* hidden native file input – camera (mobile only) */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      {/* hidden native file input – file picker (works everywhere) */}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg active:scale-[.97] transition-transform"
          style={{ backgroundColor: "var(--sage-500)" }}
        >
          <Camera size={24} />
          Open Camera
        </button>

        <button
          onClick={() => uploadRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold shadow-lg active:scale-[.97] transition-transform"
          style={{
            backgroundColor: "var(--sage-100)",
            color: "var(--sage-700)",
            border: "2px solid var(--sage-300)",
          }}
        >
          <Upload size={24} />
          Upload Photo
        </button>
      </div>
    </div>
  );
}

/* ───── Loading Screen ───── */
function LoadingScreen({ imageUrl }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 gap-8 animate-fade-in-up">
      {/* captured image with overlay */}
      <div className="relative w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden shadow-lg">
        <img
          src={imageUrl}
          alt="Pantry capture"
          className="w-full h-full object-cover"
        />
        {/* overlay */}
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-4">
          <Sparkles size={40} className="text-white animate-pulse-slow" />
          <span className="text-white text-xl font-bold tracking-wide animate-pulse-slow">
            AI Scanning…
          </span>
        </div>
      </div>

      {/* progress bar */}
      <div className="w-full max-w-xs">
        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--sage-200)" }}
        >
          <div
            className="h-full rounded-full animate-progress"
            style={{ backgroundColor: "var(--sage-500)" }}
          />
        </div>
        <p className="text-center text-sm mt-2" style={{ color: "var(--sage-600)" }}>
          Identifying ingredients…
        </p>
      </div>
    </div>
  );
}

/* ───── Recipe Card ───── */
function RecipeCard({ recipe }) {
  return (
    <div
      className="min-w-[280px] max-w-[300px] flex-shrink-0 rounded-2xl p-5 shadow-md flex flex-col gap-3"
      style={{ backgroundColor: "white", border: "1px solid var(--sage-200)" }}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChefHat size={20} style={{ color: "var(--sage-500)" }} />
          <h3 className="font-bold text-lg leading-snug" style={{ color: "var(--sage-800)" }}>
            {recipe.title}
          </h3>
        </div>
      </div>

      {/* match badge */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full"
          style={{
            backgroundColor: recipe.match >= 80 ? "var(--sage-200)" : "var(--cream-dark)",
            color: recipe.match >= 80 ? "var(--sage-700)" : "var(--sage-600)",
          }}
        >
          <Check size={14} />
          {recipe.match}% Pantry Match
        </span>
      </div>

      {/* ingredients */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--sage-500)" }}>
          Ingredients
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {recipe.ingredients.map((ing) => (
            <li
              key={ing}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ backgroundColor: "var(--sage-50)", color: "var(--sage-700)" }}
            >
              {ing}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───── Results Screen ───── */
function ResultsScreen({ recipes, ingredients, onReset }) {
  return (
    <div className="min-h-dvh px-6 py-10 flex flex-col gap-6 animate-fade-in-up">
      {/* header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onReset}
          className="p-2 rounded-xl"
          style={{ backgroundColor: "var(--sage-100)" }}
        >
          <ArrowLeft size={22} style={{ color: "var(--sage-700)" }} />
        </button>
        <h2 className="text-xl font-bold" style={{ color: "var(--sage-800)" }}>
          Your Recipes
        </h2>
        <div className="w-10" /> {/* spacer */}
      </div>

      {/* detected ingredients (debug info) */}
      <div className="px-1">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--sage-500)" }}>
          Based on:
        </p>
        {ingredients && ingredients.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ing) => (
              <span
                key={ing}
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: "var(--sage-100)", color: "var(--sage-700)" }}
              >
                {ing}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm italic" style={{ color: "var(--sage-600)" }}>
            No ingredients detected. Try a clearer photo.
          </p>
        )}
      </div>

      <p className="text-sm" style={{ color: "var(--sage-600)" }}>
        <UtensilsCrossed size={16} className="inline mr-1 -mt-0.5" />
        We found <strong>{recipes.length} recipes</strong> from your pantry items.
      </p>

      {/* horizontal scroll list */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>

      {/* scan again */}
      <button
        onClick={onReset}
        className="mt-auto w-full max-w-xs mx-auto flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg active:scale-[.97] transition-transform"
        style={{ backgroundColor: "var(--sage-500)" }}
      >
        <Camera size={24} />
        Scan Again
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   App — state machine: home → camera → loading → results
   ═══════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("home"); // home | camera | loading | results
  const [imageUrl, setImageUrl] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [detectedIngredients, setDetectedIngredients] = useState([]);
  const [error, setError] = useState(null);

  /* After a photo is captured, upload to API */
  const handleCapture = async (file, url) => {
    setImageUrl(url);
    setScreen("loading");
    setError(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append(
      "preferences",
      JSON.stringify({
        dietary_restrictions: [],
        cuisine_preferences: [],
        meal_type: "dinner",
        skill_level: "beginner",
        additional_prompt: "something quick",
      })
    );

    try {
      const res = await fetch("http://localhost:8000/api/scan", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Scan failed");
      }

      const data = await res.json();
      setRecipes(data.recipes);
      setDetectedIngredients(data.detected_ingredients);
      setScreen("results");
    } catch (err) {
      console.error(err);
      setError(err.message);
      alert(`Error scanning pantry: ${err.message}`);
      setScreen("home");
    }
  };

  const handleReset = () => {
    setImageUrl(null);
    setScreen("home");
  };

  return (
    <div className="relative" style={{ backgroundColor: "var(--cream)", minHeight: "100dvh" }}>
      {screen === "home" && <HomeScreen onScan={() => setScreen("camera")} />}
      {screen === "camera" && (
        <CameraScreen onCapture={handleCapture} onBack={() => setScreen("home")} />
      )}
      {screen === "loading" && <LoadingScreen imageUrl={imageUrl} />}
      {screen === "results" && (
        <ResultsScreen
          recipes={recipes}
          ingredients={detectedIngredients}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
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
  Heart,
  LogOut,
  BookHeart,
  UserRound,
  Loader,
  Home,
  SlidersHorizontal,
  ClipboardList,
} from "lucide-react";
import { auth, provider, db } from "./firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import Questionnaire from "./Questionnaire";
const FavoritesScreen = lazy(() => import("./FavoritesScreen"));
const CameraScreen = lazy(() => import("./CameraScreen"));

/* Lazy-load fallback */
const LazyFallback = () => (
  <div className="flex items-center justify-center min-h-dvh bg-pantry">
    <Loader size={28} className="animate-spin" style={{ color: "var(--sage-500)" }} />
  </div>
);

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

/* ═══════════════════════════════════════════════════
   Utility — send images + prefs to backend
   ═══════════════════════════════════════════════════ */
async function fetchRecipes(base64Images, preferences) {
  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8000/api/scan";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: base64Images, preferences }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

/* ═══════════════════════════════════════════════════
   Reusable Google "G" icon
   ═══════════════════════════════════════════════════ */
const GoogleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.003 24.003 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

/* ═══════════════════════════════════════════════════
   Login Screen
   ═══════════════════════════════════════════════════ */
function LoginScreen({ onGuest }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      /* onAuthStateChanged in App handles the redirect logic */
    } catch (err) {
      if (
        err.code === "auth/popup-blocked" ||
        err.code === "auth/popup-closed-by-user" ||
        err.code === "auth/cancelled-popup-request"
      ) {
        sessionStorage.setItem("pendingRedirect", "1");
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error("Login failed:", err);
      setError("Sign-in failed — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 gap-10 bg-pantry">
      <div className="flex flex-col items-center gap-5 stagger-1">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center glow-circle"
          style={{ backgroundColor: "var(--sage-100)" }}
        >
          <Leaf size={48} style={{ color: "var(--sage-500)" }} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1
            className="font-display text-5xl sm:text-6xl font-bold text-center leading-tight tracking-tight"
            style={{ color: "var(--sage-800)" }}
          >
            Treat Your‑shelf
          </h1>
          <div className="w-12 h-1 rounded-full" style={{ backgroundColor: "var(--sage-400)" }} />
          <p className="text-center max-w-xs text-base mt-1" style={{ color: "var(--sage-600)" }}>
            Snap your pantry, discover healthy recipes.
          </p>
        </div>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3 stagger-2">
        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold shadow-lg active:scale-[.97] transition-all btn-glow disabled:opacity-60"
          style={{ backgroundColor: "var(--sage-500)", color: "white" }}
        >
          <GoogleIcon />
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>

        {/* divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--sage-200)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--sage-400)" }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--sage-200)" }} />
        </div>

        {/* Guest */}
        <button
          onClick={onGuest}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold active:scale-[.97] transition-transform"
          style={{ backgroundColor: "var(--cream-dark)", color: "var(--sage-700)", border: "2px solid var(--sage-200)" }}
        >
          <UserRound size={22} />
          Continue as Guest
        </button>

        {error && (
          <p className="text-center text-sm font-medium" style={{ color: "#c44" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Home Screen — central hub
   ═══════════════════════════════════════════════════ */
function HomeScreen({
  user,
  isGuest,
  hasPreferences,
  onScan,
  onQuestionnaire,
  onFavorites,
  onLogout,
}) {
  return (
    <div className="flex flex-col min-h-dvh px-6 py-8 bg-pantry">
      {/* ── top bar: avatar + logout ── */}
      <div className="w-full flex items-center justify-between mb-8 stagger-1">
        <div className="flex items-center gap-3">
          {!isGuest && user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-11 h-11 rounded-full object-cover shadow-md ring-2 ring-white"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--sage-100)" }}
            >
              <UserRound size={20} style={{ color: "var(--sage-500)" }} />
            </div>
          )}
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: "var(--sage-800)" }}>
              {isGuest ? "Guest" : user?.displayName ?? "Friend"}
            </p>
            <p className="text-xs" style={{ color: "var(--sage-400)" }}>
              Welcome back!
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-2.5 rounded-xl transition-colors"
          style={{ backgroundColor: "var(--sage-100)" }}
          aria-label={isGuest ? "Back to login" : "Log out"}
        >
          <LogOut size={20} style={{ color: "var(--sage-600)" }} />
        </button>
      </div>

      {/* ── branding ── */}
      <div className="flex flex-col items-center gap-3 mb-10 stagger-2">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center glow-circle"
          style={{ backgroundColor: "var(--sage-100)" }}
        >
          <Leaf size={32} style={{ color: "var(--sage-500)" }} />
        </div>
        <h1
          className="font-display text-4xl sm:text-5xl font-bold text-center tracking-tight"
          style={{ color: "var(--sage-800)" }}
        >
          Treat Your‑shelf
        </h1>
        <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--sage-300)" }} />
      </div>

      {/* ── action cards ── */}
      <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
        {/* Primary action */}
        {hasPreferences ? (
          <button
            onClick={onScan}
            className="stagger-3 card-action w-full flex items-center gap-4 p-5 rounded-2xl text-left shadow-lg btn-glow"
            style={{ backgroundColor: "var(--sage-500)", color: "white" }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/20 flex-shrink-0">
              <Camera size={24} />
            </div>
            <div>
              <p className="font-bold text-lg">Scan My Pantry</p>
              <p className="text-sm opacity-80">Take photos &amp; discover recipes based off your preferences </p>
            </div>
          </button>
        ) : (
          <button
            onClick={onQuestionnaire}
            className="stagger-3 card-action w-full flex items-center gap-4 p-5 rounded-2xl text-left shadow-lg btn-glow"
            style={{ backgroundColor: "var(--sage-500)", color: "white" }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/20 flex-shrink-0">
              <ClipboardList size={24} />
            </div>
            <div>
              <p className="font-bold text-lg">Get Started</p>
              <p className="text-sm opacity-80">Set up your dietary preferences</p>
            </div>
          </button>
        )}

        {/* My Favorites — logged-in only */}
        {!isGuest && (
          <button
            onClick={onFavorites}
            className="stagger-4 card-action card-elevated w-full flex items-center gap-4 p-5 rounded-2xl text-left"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--sage-100)" }}
            >
              <BookHeart size={24} style={{ color: "var(--sage-600)" }} />
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: "var(--sage-800)" }}>
                My Favorites
              </p>
              <p className="text-sm" style={{ color: "var(--sage-500)" }}>
                View your saved recipes
              </p>
            </div>
          </button>
        )}

        {/* Edit Preferences — show only when already completed */}
        {hasPreferences && (
          <button
            onClick={onQuestionnaire}
            className="stagger-5 card-action card-elevated w-full flex items-center gap-4 p-5 rounded-2xl text-left"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--sage-100)" }}
            >
              <SlidersHorizontal size={24} style={{ color: "var(--sage-600)" }} />
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: "var(--sage-800)" }}>
                Edit Preferences
              </p>
              <p className="text-sm" style={{ color: "var(--sage-500)" }}>
                Update diet, allergies &amp; goals
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Guest nudge */}
      {isGuest && (
        <p className="stagger-6 mt-auto pt-8 text-center text-xs" style={{ color: "var(--sage-400)" }}>
          Sign in to save favorites and sync preferences across devices.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Loading Screen (shows first image from array)
   ═══════════════════════════════════════════════════ */
function LoadingScreen({ imageUrls }) {
  const preview = imageUrls?.[0];
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 gap-8 bg-pantry animate-fade-in-up">
      <div className="relative w-full max-w-xs aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl animate-pulse-glow">
        {preview ? (
          <img src={preview} alt="Pantry capture" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full animate-shimmer" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent flex flex-col items-center justify-center gap-4">
          <Sparkles size={44} className="text-white animate-pulse-slow drop-shadow-lg" />
          <span className="font-display text-white text-2xl font-bold tracking-wide animate-pulse-slow drop-shadow-lg">
            AI Scanning…
          </span>
          {imageUrls?.length > 1 && (
            <span className="text-white/80 text-sm">
              Analyzing {imageUrls.length} images
            </span>
          )}
        </div>
      </div>

      <div className="w-full max-w-xs stagger-2">
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--sage-200)" }}>
          <div className="h-full rounded-full animate-progress" style={{ backgroundColor: "var(--sage-500)" }} />
        </div>
        <p className="text-center text-sm mt-3 font-medium" style={{ color: "var(--sage-600)" }}>
          Identifying ingredients…
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Recipe Card (with heart toggle)
   ═══════════════════════════════════════════════════ */
function RecipeCard({ recipe, isFav, onToggleFav }) {
  return (
    <div
      className="min-w-[280px] max-w-[300px] flex-shrink-0 rounded-2xl p-5 card-elevated flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChefHat size={20} style={{ color: "var(--sage-500)" }} />
          <h3 className="font-display font-bold text-lg leading-snug" style={{ color: "var(--sage-800)" }}>
            {recipe.title}
          </h3>
        </div>
        <button
          onClick={() => onToggleFav(recipe.id)}
          className="p-1.5 rounded-full active:scale-90 transition-transform"
          style={{ backgroundColor: "var(--sage-50)" }}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={18} fill={isFav ? "var(--sage-500)" : "none"} style={{ color: "var(--sage-500)" }} />
        </button>
      </div>

      <span
        className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full self-start"
        style={{
          backgroundColor: recipe.match >= 80 ? "var(--sage-200)" : "var(--cream-dark)",
          color: recipe.match >= 80 ? "var(--sage-700)" : "var(--sage-600)",
        }}
      >
        <Check size={14} />
        {recipe.match}% Pantry Match
      </span>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--sage-500)" }}>
          Ingredients
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {recipe.ingredients.map((ing) => (
            <li key={ing} className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: "var(--sage-50)", color: "var(--sage-700)" }}>
              {ing}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Results Screen
   ═══════════════════════════════════════════════════ */
function ResultsScreen({ recipes, favoriteIds, onToggleFav, onReset, onHome, isGuest }) {
  return (
    <div className="min-h-dvh px-6 py-10 flex flex-col gap-6 bg-pantry animate-fade-in-up">
      <div className="flex items-center justify-between stagger-1">
        <button onClick={onHome} className="p-2 rounded-xl transition-colors" style={{ backgroundColor: "var(--sage-100)" }}>
          <ArrowLeft size={22} style={{ color: "var(--sage-700)" }} />
        </button>
        <h2 className="font-display text-xl font-bold" style={{ color: "var(--sage-800)" }}>Your Recipes</h2>
        <div className="w-10" />
      </div>

      <p className="text-sm stagger-2" style={{ color: "var(--sage-600)" }}>
        <UtensilsCrossed size={16} className="inline mr-1 -mt-0.5" />
        We found <strong>{recipes.length} recipes</strong> from your pantry items.
      </p>

      {isGuest && (
        <p
          className="text-xs text-center px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: "var(--sage-50)", color: "var(--sage-500)" }}
        >
          Sign in to save your favorite recipes across sessions.
        </p>
      )}

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6 stagger-3">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} isFav={favoriteIds.includes(r.id)} onToggleFav={onToggleFav} />
        ))}
      </div>

      <div className="mt-auto w-full max-w-xs mx-auto flex flex-col gap-3 stagger-4">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg active:scale-[.97] transition-all btn-glow"
          style={{ backgroundColor: "var(--sage-500)" }}
        >
          <Camera size={24} />
          Scan Again
        </button>
        <button
          onClick={onHome}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold shadow-lg active:scale-[.97] transition-all"
          style={{ backgroundColor: "white", color: "var(--sage-700)", border: "2px solid var(--sage-200)" }}
        >
          <Home size={24} />
          Back to Home
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   App — auth → questionnaire / camera → loading → results
   ═══════════════════════════════════════════════════ */
export default function App() {
  /* auth */
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  /* flow */
  const [screen, setScreen] = useState("login");
  const [imageUrls, setImageUrls] = useState([]);
  const [base64Images, setBase64Images] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [recipes, setRecipes] = useState(MOCK_RECIPES);

  /* ── 1. Auth listener — all logged-in users land on the home hub ── */
  useEffect(() => {
    /* Only call getRedirectResult when we actually initiated a redirect,
       avoiding the 2-5 s penalty on every cold load. */
    if (sessionStorage.getItem("pendingRedirect")) {
      sessionStorage.removeItem("pendingRedirect");
      getRedirectResult(auth).catch((err) => {
        console.error("Redirect sign-in error:", err);
      });
    }

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        setIsGuest(false);
        /* Show the home screen IMMEDIATELY — don't block on Firestore */
        setScreen("home");
        setAuthLoading(false);

        /* Hydrate preferences in the background (non-blocking) */
        Promise.race([
          getDoc(doc(db, "users", fbUser.uid)),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("Firestore timeout")), 3000)
          ),
        ])
          .then((snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setPreferences(data.preferences ?? null);
              setQuestionnaireCompleted(!!data.questionnaireCompleted);
              setFavoriteIds(data.favorites ?? []);
            }
          })
          .catch((err) => {
            console.error("Firestore read failed (non-blocking):", err);
          });
      } else {
        setUser(null);
        setScreen("login");
        setAuthLoading(false);
      }
    });
    return unsub;
  }, []);

  /* ── 2. Questionnaire complete → back to home hub ── */
  const handleQuestionnaireComplete = (answers) => {
    setPreferences(answers);
    setQuestionnaireCompleted(true);
    setScreen("home");
  };

  /* ── 3. Camera capture (multi-image) ── */
  const handleCapture = (previews, b64Arr) => {
    setImageUrls(previews);
    setBase64Images(b64Arr);
    setScreen("loading");
  };

  /* auto-advance loading → results */
  useEffect(() => {
    if (screen !== "loading") return;
    let cancelled = false;

    const run = async () => {
      try {
        const data = await Promise.race([
          fetchRecipes(base64Images, preferences),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        if (!cancelled) setRecipes(data.recipes ?? MOCK_RECIPES);
      } catch {
        if (!cancelled) setRecipes(MOCK_RECIPES);
      }
      if (!cancelled) setScreen("results");
    };

    const timer = setTimeout(run, 3200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [screen, base64Images, preferences]);

  /* ── Guest mode ── */
  const handleGuest = () => {
    setIsGuest(true);
    setUser(null);
    setAuthLoading(false);
    setScreen("questionnaire");
  };

  /* ── 4. Toggle favorite ── */
  const toggleFavorite = useCallback(
    async (recipeId) => {
      const alreadyFav = favoriteIds.includes(recipeId);
      setFavoriteIds((prev) =>
        alreadyFav ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
      );

      if (isGuest || !user) return;

      const docRef = doc(db, "users", user.uid);
      try {
        await updateDoc(docRef, {
          favorites: alreadyFav ? arrayRemove(recipeId) : arrayUnion(recipeId),
        });
      } catch (err) {
        console.error("Favorite toggle failed:", err);
        setFavoriteIds((prev) =>
          alreadyFav ? [...prev, recipeId] : prev.filter((id) => id !== recipeId)
        );
      }
    },
    [user, favoriteIds, isGuest]
  );

  const removeFavorite = useCallback(
    (recipeId) => toggleFavorite(recipeId),
    [toggleFavorite]
  );

  /* ── Logout ── */
  const handleLogout = async () => {
    if (!isGuest) await signOut(auth);
    setUser(null);
    setIsGuest(false);
    setPreferences(null);
    setQuestionnaireCompleted(false);
    setFavoriteIds([]);
    setScreen("login");
  };

  /* ── Scan Again (results → camera) ── */
  const handleReset = () => {
    setImageUrls([]);
    setBase64Images([]);
    setScreen("camera");
  };

  /* ── Back to Home (results → home hub) ── */
  const handleGoHome = () => {
    setImageUrls([]);
    setBase64Images([]);
    setScreen("home");
  };

  /* ── auth splash / loading spinner ── */
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 min-h-dvh bg-pantry">
        <div className="w-16 h-16 rounded-full flex items-center justify-center glow-circle" style={{ backgroundColor: "var(--sage-100)" }}>
          <Loader size={28} className="animate-spin" style={{ color: "var(--sage-500)" }} />
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--sage-400)" }}>Loading your profile…</p>
      </div>
    );
  }

  /* ── render ── */
  return (
    <div className="relative bg-pantry" style={{ minHeight: "100dvh" }}>
      {screen === "login" && <LoginScreen onGuest={handleGuest} />}

      {screen === "questionnaire" && (
        <Questionnaire user={user} onComplete={handleQuestionnaireComplete} onBack={() => setScreen("home")} />
      )}

      {screen === "home" && (
        <HomeScreen
          user={user}
          isGuest={isGuest}
          hasPreferences={questionnaireCompleted}
          onScan={() => setScreen("camera")}
          onQuestionnaire={() => setScreen("questionnaire")}
          onFavorites={() => setScreen("favorites")}
          onLogout={handleLogout}
        />
      )}

      {screen === "favorites" && (
        <Suspense fallback={<LazyFallback />}>
          <FavoritesScreen
            user={user}
            isGuest={isGuest}
            allRecipes={MOCK_RECIPES}
            onBack={() => setScreen("home")}
            onRemove={removeFavorite}
          />
        </Suspense>
      )}

      {screen === "camera" && (
        <Suspense fallback={<LazyFallback />}>
          <CameraScreen onCapture={handleCapture} onBack={() => setScreen("home")} />
        </Suspense>
      )}

      {screen === "loading" && <LoadingScreen imageUrls={imageUrls} />}

      {screen === "results" && (
        <ResultsScreen
          recipes={recipes}
          favoriteIds={favoriteIds}
          onToggleFav={toggleFavorite}
          onReset={handleReset}
          onHome={handleGoHome}
          isGuest={isGuest}
        />
      )}
    </div>
  );
}

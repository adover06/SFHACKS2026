"use client";

import { ArrowLeft, Heart, ChefHat, Check } from "lucide-react";

/* single favorite card */
function FavoriteCard({ recipe, onRemove }) {
  return (
    <div className="rounded-2xl p-5 card-elevated flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChefHat size={20} style={{ color: "var(--sage-500)" }} />
          <h3 className="font-display font-bold text-lg leading-snug" style={{ color: "var(--sage-800)" }}>
            {recipe.title}
          </h3>
        </div>
        <button
          onClick={() => onRemove(recipe.id)}
          className="p-1.5 rounded-full active:scale-90 transition-transform"
          style={{ backgroundColor: "var(--sage-50)" }}
          aria-label="Remove from favorites"
        >
          <Heart size={18} fill="var(--sage-500)" style={{ color: "var(--sage-500)" }} />
        </button>
      </div>

      {recipe.match != null && (
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
      )}

      {recipe.ingredients?.length > 0 && (
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
      )}
    </div>
  );
}

/* Favorites Screen */
export default function FavoritesScreen({ favorites, onBack, onRemove }) {
  return (
    <div className="min-h-dvh px-6 py-10 flex flex-col gap-6 bg-pantry animate-fade-in-up pt-safe">
      {/* header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl"
          style={{ backgroundColor: "var(--sage-100)" }}
        >
          <ArrowLeft size={22} style={{ color: "var(--sage-700)" }} />
        </button>
        <h2 className="font-display text-xl font-bold" style={{ color: "var(--sage-800)" }}>
          My Favorites
        </h2>
        <div className="w-10" />
      </div>

      {/* body */}
      {favorites.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Heart size={48} style={{ color: "var(--sage-300)" }} />
          <p className="text-center max-w-[260px]" style={{ color: "var(--sage-500)" }}>
            No favorites yet. Scan your pantry and heart the recipes you love!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
          {favorites.map((r) => (
            <FavoriteCard key={r.id} recipe={r} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

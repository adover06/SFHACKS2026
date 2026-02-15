import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/* ───── step definitions ───── */
const STEPS = [
  {
    key: "dietary",
    title: "Dietary Preference",
    subtitle: "Tell us about your diet",
    placeholder: "e.g. Vegan, Keto, Paleo, Vegetarian, None",
  },
  {
    key: "allergies",
    title: "Any Allergies?",
    subtitle: "We'll filter these out of your recipes",
    placeholder: "e.g. Peanuts, Dairy, Gluten, Shellfish, None",
  },
  {
    key: "cuisine",
    title: "Favorite Cuisines",
    subtitle: "Pick your go-to flavors",
    placeholder: "e.g. Italian, Mexican, Asian, Mediterranean",
  },
  {
    key: "goal",
    title: "What's Your Goal?",
    subtitle: "We'll tailor recipes to match",
    placeholder: "e.g. Muscle Gain, Weight Loss, Save Time",
  },
];

/* ───── main questionnaire ───── */
export default function Questionnaire({ user, onComplete, onBack }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    dietary: "",
    allergies: "",
    cuisine: "",
    goal: "",
  });
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  /* validation — current field must not be blank */
  const currentValue = answers[current.key].trim();
  const canAdvance = currentValue.length > 0;

  const handleNext = async () => {
    if (!canAdvance) return;

    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }

    /* last step → save to Firestore then continue */
    setSaving(true);
    try {
      if (user?.uid) {
        await Promise.race([
          setDoc(
            doc(db, "users", user.uid),
            {
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              preferences: answers,
              questionnaireCompleted: true,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("Firestore timeout")), 5000)
          ),
        ]);
      }
      onComplete(answers);
    } catch (err) {
      console.error("Error saving preferences:", err);
      /* Still let them through so the app isn't stuck */
      onComplete(answers);
    } finally {
      setSaving(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="flex flex-col min-h-dvh px-6 py-10 bg-pantry">
      {/* header — back to home */}
      {onBack && (
        <div className="flex items-center justify-between mb-6 stagger-1">
          <button
            onClick={onBack}
            className="p-2 rounded-xl transition-colors"
            style={{ backgroundColor: "var(--sage-100)" }}
            aria-label="Back to home"
          >
            <ArrowLeft size={22} style={{ color: "var(--sage-700)" }} />
          </button>
          <p className="font-display text-sm font-bold" style={{ color: "var(--sage-800)" }}>Preferences</p>
          <div className="w-10" />
        </div>
      )}

      {/* progress bar */}
      <div
        className="w-full h-2 rounded-full overflow-hidden mb-8 stagger-1"
        style={{ backgroundColor: "var(--sage-200)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: "var(--sage-500)" }}
        />
      </div>

      {/* step indicator */}
      <p className="text-xs font-semibold uppercase tracking-wider mb-1 stagger-2" style={{ color: "var(--sage-400)" }}>
        Step {step + 1} of {STEPS.length}
      </p>

      {/* title */}
      <h2 className="font-display text-3xl font-bold mb-1 stagger-3" style={{ color: "var(--sage-800)" }}>
        {current.title}
      </h2>
      <p className="text-sm mb-8 stagger-3" style={{ color: "var(--sage-600)" }}>
        {current.subtitle}
      </p>

      {/* text input */}
      <div className="mb-auto stagger-4">
        <input
          type="text"
          value={answers[current.key]}
          onChange={(e) =>
            setAnswers((prev) => ({ ...prev, [current.key]: e.target.value }))
          }
          placeholder={current.placeholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAdvance && !saving) handleNext();
          }}
          className="w-full px-5 py-4 rounded-2xl text-base outline-none transition-shadow focus:ring-2"
          style={{
            backgroundColor: "white",
            color: "var(--sage-800)",
            border: "2px solid var(--sage-200)",
            boxShadow: "none",
            "--tw-ring-color": "var(--sage-400)",
          }}
        />
        {!canAdvance && answers[current.key].length > 0 && (
          <p className="text-xs mt-2" style={{ color: "#c44" }}>
            Please enter a non-empty value.
          </p>
        )}
      </div>

      {/* navigation */}
      <div className="flex items-center justify-between mt-10">
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="p-3 rounded-xl"
            style={{ backgroundColor: "var(--sage-100)" }}
          >
            <ArrowLeft size={22} style={{ color: "var(--sage-700)" }} />
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleNext}
          disabled={!canAdvance || saving}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white shadow-lg active:scale-[.97] transition-all btn-glow disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--sage-500)" }}
        >
          {saving ? (
            <>
              <Sparkles size={18} className="animate-spin" /> Saving…
            </>
          ) : isLast ? (
            <>
              Finish <Check size={18} />
            </>
          ) : (
            <>
              Next <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

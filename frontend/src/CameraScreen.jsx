import { useState, useRef } from "react";
import { Camera, Upload, ArrowLeft, ScanLine, X, Sparkles } from "lucide-react";

/**
 * Convert a File to a base64 data-URL string.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CameraScreen({ onCapture, onBack }) {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);

  /* Each entry: { id, previewUrl, base64 } */
  const [images, setImages] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);
    setImages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, previewUrl, base64 },
    ]);
    /* reset so the same file can be re-selected */
    e.target.value = "";
  };

  const removeImage = (id) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleAnalyze = () => {
    /* Pass arrays of preview URLs and base64 strings to the parent */
    onCapture(
      images.map((i) => i.previewUrl),
      images.map((i) => i.base64)
    );
  };

  return (
    <div className="flex flex-col min-h-dvh px-6 py-10 bg-pantry animate-fade-in-up">
      {/* back button */}
      <button
        onClick={onBack}
        className="self-start p-2 rounded-xl mb-6"
        style={{ backgroundColor: "var(--sage-100)" }}
      >
        <ArrowLeft size={22} style={{ color: "var(--sage-700)" }} />
      </button>

      {/* hero icon */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center glow-circle"
          style={{ backgroundColor: "var(--sage-100)" }}
        >
          <ScanLine size={52} style={{ color: "var(--sage-500)" }} />
        </div>
        <h2 className="font-display text-2xl font-bold" style={{ color: "var(--sage-800)" }}>
          Capture Your Pantry
        </h2>
        <p className="text-sm text-center max-w-xs" style={{ color: "var(--sage-600)" }}>
          Take multiple photos of your fridge, shelves, or counters for the best results.
        </p>
      </div>

      {/* ── thumbnail gallery ── */}
      {images.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--sage-500)" }}>
            {images.length} {images.length === 1 ? "photo" : "photos"} selected
          </p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden shadow-sm"
                style={{ border: "2px solid var(--sage-200)" }}
              >
                <img
                  src={img.previewUrl}
                  alt="Pantry"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 active:scale-90 transition-transform"
                  aria-label="Remove photo"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── capture buttons ── */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <div className="w-full max-w-xs mx-auto flex flex-col gap-3 mt-auto">
        <button
          onClick={() => cameraRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg active:scale-[.97] transition-all btn-glow"
          style={{ backgroundColor: "var(--sage-500)" }}
        >
          <Camera size={24} />
          Open Camera
        </button>

        <button
          onClick={() => uploadRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold shadow-lg active:scale-[.97] transition-all"
          style={{
            backgroundColor: "var(--sage-100)",
            color: "var(--sage-700)",
            border: "2px solid var(--sage-300)",
          }}
        >
          <Upload size={24} />
          Upload Photo
        </button>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={images.length === 0}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-semibold text-white shadow-lg active:scale-[.97] transition-all btn-glow disabled:opacity-40 disabled:pointer-events-none"
          style={{ backgroundColor: "var(--sage-700)" }}
        >
          <Sparkles size={22} />
          Analyze {images.length} {images.length === 1 ? "Image" : "Images"}
        </button>
      </div>
    </div>
  );
}

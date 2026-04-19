"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type InputMode = "text" | "upload";

type TeamKnowledge = {
  name: string;
  industry: string;
  preferredStack: string[];
  values: string[];
  constraints: string[];
  targetAudience: string[];
  designSystem: string[];
};

type TeamImportAnalysis = {
  summary: string;
  categories: { title: string; points: string[] }[];
  normalized: TeamKnowledge;
};

export default function TeamPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showAnalysisProgress, setShowAnalysisProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mode, setMode] = useState<InputMode>("text");
  const [rawText, setRawText] = useState("");
  const [rawJsonText, setRawJsonText] = useState("");
  const [pendingFileContent, setPendingFileContent] = useState("");
  const [pendingFileInputType, setPendingFileInputType] = useState<"json" | "text" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [importAnalysis, setImportAnalysis] = useState<TeamImportAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== "authenticated" && status !== "unauthenticated") {
      return;
    }

    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }

    setLoading(false);
  }, [status]);

  const resetTeamInfo = async () => {
    const confirmed = window.confirm("Clear all saved team info?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/team", {
        method: "DELETE",
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to reset");
      }

      setRawText("");
      setRawJsonText("");
      setPendingFileContent("");
      setPendingFileInputType(null);
      setSelectedFileName("");
      setImportAnalysis(null);
      setShowAnalysisProgress(false);
      setAnalysisProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSuccess("Profile info reset.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset team info");
    } finally {
      setSaving(false);
    }
  };

  const analyzeImport = async (inputType: "text" | "json", content: string) => {
    setAnalyzing(true);
    setShowAnalysisProgress(true);
    setAnalysisProgress(0);
    setError(null);
    setSuccess(null);
    setImportAnalysis(null);

    const progressTimer = setInterval(() => {
      setAnalysisProgress((prev) => {
        const target = 95;
        const eased = prev + (target - prev) * 0.08;

        if (eased >= target) {
          return target - 0.001;
        }

        return eased;
      });
    }, 80);

    try {
      const res = await fetch("/api/team/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType, content }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.issues?.[0] || body?.error || "Import failed");
      }

      clearInterval(progressTimer);
      setAnalysisProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 250));

      setImportAnalysis(body.analysis || null);
      setSuccess("AI summary ready. Review and confirm import.");
      setTimeout(() => {
        setShowAnalysisProgress(false);
      }, 250);
    } catch (e) {
      clearInterval(progressTimer);
      setShowAnalysisProgress(false);
      setAnalysisProgress(0);
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmImport = async () => {
    if (!importAnalysis?.normalized) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importAnalysis.normalized),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.issues?.[0] || body?.error || "Failed to save team profile");
      }

      router.push("/projects/new");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save team profile");
      setSaving(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;

    setError(null);
    setSuccess(null);
    setImportAnalysis(null);
    setSelectedFileName(file.name);

    const content = await file.text();
    const isJson = file.name.toLowerCase().endsWith(".json");

    setPendingFileContent(content);
    setPendingFileInputType(isJson ? "json" : "text");
    setRawJsonText(isJson ? content : "");
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] || null;
    await handleUpload(file);
  };

  if (loading || status === "loading") {
    return (
      <div className="mx-auto max-w-5xl p-8 text-neutral-300">Loading team profile...</div>
    );
  }

  if (!session?.user?.email) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="app-frame rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Team Profile</h1>
          <p className="mt-3 text-neutral-400">Sign in to manage a personal team profile used by project planning AI.</p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/team" })}
            className="mt-6 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-white/90 cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Team Profile</h1>
        <p className="mt-2 text-sm text-neutral-400">This profile is stored per user and used to personalize generated plans for teams and organizations.</p>
      </header>

      <section className="app-frame rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-2">
          {(["text", "upload"] as InputMode[]).map((inputMode) => (
            <button
              key={inputMode}
              onClick={() => setMode(inputMode)}
              className={`rounded-full px-4 py-2 text-sm cursor-pointer ${
                mode === inputMode ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {inputMode === "text" ? "Paste Text" : "Upload File"}
            </button>
          ))}
        </div>

        {mode === "text" && (
          <div className="mt-4 space-y-3">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-60 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <button
              onClick={() => analyzeImport("text", rawText)}
              disabled={!rawText.trim() || saving || analyzing}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black disabled:opacity-50 cursor-pointer"
            >
              {analyzing ? "Analyzing..." : "Import from Text"}
            </button>
          </div>
        )}

        {mode === "upload" && (
          <div className="mt-4 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,.md"
              onChange={(e) => handleUpload(e.target.files?.[0] || null)}
              className="hidden"
              id="team-file-upload"
            />
            <label
              htmlFor="team-file-upload"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`app-frame-item flex min-h-56 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                isDragging
                  ? "border-white bg-white/10"
                  : "border-white/20 bg-black/30 hover:border-white/40 hover:bg-white/5"
              }`}
            >
              <p className="text-lg font-medium text-white">Drag and drop a file here</p>
              <p className="mt-2 text-sm text-neutral-400">or click to choose file</p>
              <p className="mt-2 text-xs text-neutral-500">Supported: .json, .txt, .md</p>
              {selectedFileName && <p className="mt-4 text-sm text-white/80">Selected: {selectedFileName}</p>}
            </label>
            {rawJsonText ? (
              <p className="text-xs text-neutral-500">Detected JSON upload and ready to analyze.</p>
            ) : (
              <p className="text-xs text-neutral-500">Upload `.json`, `.txt`, or `.md` files, then click Import File.</p>
            )}
            <button
              onClick={() => {
                if (!pendingFileContent || !pendingFileInputType) return;
                analyzeImport(pendingFileInputType, pendingFileContent);
              }}
              disabled={!pendingFileContent || !pendingFileInputType || saving || analyzing}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black disabled:opacity-50 cursor-pointer"
            >
              {analyzing ? "Analyzing..." : "Import File"}
            </button>
          </div>
        )}

        {showAnalysisProgress && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-150 ease-linear"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>
        )}

        {importAnalysis && (
          <div className="mt-6 border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold text-white">AI Summary</h2>
            <p className="mt-2 text-sm text-neutral-300">{importAnalysis.summary}</p>

            <div className="mt-4 space-y-4">
              {importAnalysis.categories.length === 0 ? (
                <p className="text-sm text-neutral-400">No strong categories detected.</p>
              ) : (
                importAnalysis.categories.map((category, index) => (
                  <div key={`${category.title}-${index}`} className="app-frame-item rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">{category.title}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                      {category.points.map((point, pointIndex) => (
                        <li key={`${category.title}-point-${pointIndex}`}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={confirmImport}
              disabled={saving || analyzing}
              className="mt-5 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Confirming..." : "Confirm Import"}
            </button>
          </div>
        )}

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            onClick={resetTeamInfo}
            disabled={saving || analyzing}
            className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Resetting..." : "Reset Profile Info"}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-4 text-sm text-green-400">{success}</p>}
      </section>
    </main>
  );
}

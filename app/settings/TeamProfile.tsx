"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

export type TeamProfileTab = "overview" | "import" | "reset";

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

type TeamProfileProps = {
  activeTab: TeamProfileTab;
  onChangeTab: (tab: TeamProfileTab) => void;
};

type TeamProfileFetchResponse = {
  team?: TeamKnowledge;
  source?: "user" | "default";
  updatedAt?: string;
};

export const TEAM_PROFILE_TABS: Array<{ key: TeamProfileTab; label: string; description: string }> = [
  { key: "overview", label: "Profile Overview", description: "Imported profile data" },
  { key: "import", label: "Import", description: "Text or file input" },
  { key: "reset", label: "Reset", description: "Delete all profile data" },
];

export function TeamProfile({ activeTab, onChangeTab }: TeamProfileProps) {
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
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
  const [savedProfile, setSavedProfile] = useState<TeamKnowledge | null>(null);
  const [savedProfileUpdatedAt, setSavedProfileUpdatedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSavedProfile = async () => {
      try {
        const res = await fetch("/api/team");
        const body = (await res.json().catch(() => ({}))) as TeamProfileFetchResponse;

        if (!res.ok) {
          throw new Error("Failed to load team profile");
        }

        if (cancelled) return;

        if (body.source === "user" && body.team) {
          setSavedProfile(body.team);
          setSavedProfileUpdatedAt(body.updatedAt || null);
        } else {
          setSavedProfile(null);
          setSavedProfileUpdatedAt(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load team profile");
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    void loadSavedProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const resetTeamInfo = async () => {
    const firstConfirmation = window.confirm("Clear all saved team info?");
    if (!firstConfirmation) return;

    const secondConfirmation = window.confirm(
      "This action permanently deletes your team profile. Continue?"
    );
    if (!secondConfirmation) return;

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
      setSavedProfile(null);
      setSavedProfileUpdatedAt(null);

      setSuccess("Profile info reset.");
      onChangeTab("overview");
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
      setSuccess("Profile analyzed");
      onChangeTab("overview");
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

      setSavedProfile((body?.team as TeamKnowledge) || importAnalysis.normalized);
      setSavedProfileUpdatedAt(typeof body?.updatedAt === "string" ? body.updatedAt : null);
      setImportAnalysis(null);
      setSuccess("Profile imported");
      onChangeTab("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save team profile");
    } finally {
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

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] || null;
    await handleUpload(file);
  };

  const profileToShow = importAnalysis?.normalized ?? savedProfile;

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {activeTab === "overview" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Profile Overview</h2>
          {success === "Profile analyzed" && <p className="text-sm text-green-400">{success}</p>}

          {loadingProfile ? (
            <div className="app-frame-item rounded-xl p-5">
              <p className="text-sm text-neutral-300">Loading current profile...</p>
            </div>
          ) : !profileToShow ? (
            <div className="app-frame-item rounded-xl p-5">
              <p className="text-sm text-neutral-300">No team profile has been imported yet.</p>
              <button
                type="button"
                onClick={() => onChangeTab("import")}
                className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer"
              >
                Go to Import
              </button>
            </div>
          ) : (
            <>
              {importAnalysis && (
                <div className="app-frame-item rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Analysis preview</p>
                  <p className="mt-2 text-sm text-neutral-300">Showing analyzed output. Confirm import to save these changes.</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-frame-item rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Team name</p>
                  <p className="mt-2 text-sm font-semibold text-white">{profileToShow.name || "Not set"}</p>
                </div>
                <div className="app-frame-item rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Industry</p>
                  <p className="mt-2 text-sm font-semibold text-white">{profileToShow.industry || "Not set"}</p>
                </div>
                <div className="app-frame-item rounded-xl p-4 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Last updated</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {importAnalysis
                      ? "Pending import"
                      : savedProfileUpdatedAt
                        ? new Date(savedProfileUpdatedAt).toLocaleString()
                        : "Unknown"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  ["Preferred stack", profileToShow.preferredStack],
                  ["Values", profileToShow.values],
                  ["Constraints", profileToShow.constraints],
                  ["Target audience", profileToShow.targetAudience],
                  ["Design system", profileToShow.designSystem],
                ].map(([title, values]) => (
                  <div key={title} className="app-frame-item rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wide text-neutral-500">{title}</p>
                    {values.length === 0 ? (
                      <p className="mt-2 text-sm text-neutral-400">Not set</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {values.map((value, index) => (
                          <span
                            key={`${title}-${value}-${index}`}
                            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {success === "Profile imported" && <p className="text-sm text-green-400">{success}</p>}
            </>
          )}

          {importAnalysis && (
            <div className="app-frame-item rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Analyzed summary</p>
              <p className="mt-2 text-sm text-neutral-300">{importAnalysis.summary}</p>

              <div className="mt-3 space-y-3">
                {importAnalysis.categories.length === 0 ? (
                  <p className="text-sm text-neutral-400">No strong categories detected.</p>
                ) : (
                  importAnalysis.categories.map((category, index) => (
                    <div key={`${category.title}-${index}`} className="rounded-lg bg-white/5 p-3">
                      <p className="text-sm font-semibold text-white">{category.title}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                        {category.points.map((point, pointIndex) => (
                          <li key={`${category.title}-${pointIndex}`}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={confirmImport}
                disabled={saving || analyzing}
                className="mt-4 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Confirming..." : "Confirm Import"}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "import" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Import profile data</h2>

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
            <div className="space-y-3">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-60 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                placeholder="Paste your team profile notes or JSON content..."
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
            <div className="space-y-3">
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
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-150 ease-linear"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "reset" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Reset profile info</h2>
          <p className="text-sm text-neutral-300">
            This removes stored team profile data for your account. You can import again anytime.
          </p>
          <button
            onClick={resetTeamInfo}
            disabled={saving || analyzing}
            className="settings-reset-button rounded-full px-6 py-2 text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Resetting..." : "Reset Profile Info"}
          </button>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";

type CompanyKnowledge = {
  name: string;
  industry: string;
  preferredStack: string[];
  values: string[];
  constraints: string[];
  targetAudience: string[];
  designSystem: string[];
};

const emptyCompany: CompanyKnowledge = {
  name: "",
  industry: "",
  preferredStack: [],
  values: [],
  constraints: [],
  targetAudience: [],
  designSystem: [],
};

function toCommaText(items: string[]): string {
  return items.join(", ");
}

function fromCommaText(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

type InputMode = "manual" | "text" | "upload";

export default function CompanyPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mode, setMode] = useState<InputMode>("manual");
  const [company, setCompany] = useState<CompanyKnowledge>(emptyCompany);
  const [rawText, setRawText] = useState("");
  const [rawJsonText, setRawJsonText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }

    fetch("/api/company")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load company profile");
        }
        return res.json();
      })
      .then((data: { company: CompanyKnowledge }) => {
        setCompany(data.company || emptyCompany);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [status]);

  const canSaveManual = useMemo(() => company.name.trim() && company.industry.trim(), [company]);

  const updateArrayField = (key: keyof CompanyKnowledge, value: string) => {
    setCompany((prev) => ({ ...prev, [key]: fromCommaText(value) }));
  };

  const saveManual = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.issues?.[0] || body?.error || "Failed to save");
      }

      setCompany(body.company || company);
      setSuccess("Company profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save company profile");
    } finally {
      setSaving(false);
    }
  };

  const resetCompanyInfo = async () => {
    const confirmed = window.confirm("Clear all saved company info?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/company", {
        method: "DELETE",
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to reset");
      }

      setCompany(emptyCompany);
      setRawText("");
      setRawJsonText("");
      setSelectedFileName("");
      setMode("manual");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSuccess("Company info reset.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset company info");
    } finally {
      setSaving(false);
    }
  };

  const importTextOrJson = async (inputType: "text" | "json", content: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputType, content }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body?.issues?.[0] || body?.error || "Import failed");
      }

      setCompany(body.company || company);
      setSuccess("Company profile imported and saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;

    setSelectedFileName(file.name);
    const content = await file.text();
    const isJson = file.name.toLowerCase().endsWith(".json");
    setRawJsonText(isJson ? content : "");

    await importTextOrJson(isJson ? "json" : "text", content);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] || null;
    await handleUpload(file);
  };

  if (loading || status === "loading") {
    return (
      <div className="mx-auto max-w-5xl p-8 text-neutral-300">Loading company profile...</div>
    );
  }

  if (!session?.user?.email) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Company Profile</h1>
          <p className="mt-3 text-neutral-400">Sign in to manage a personal company profile used by project planning AI.</p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/company" })}
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
        <h1 className="text-3xl font-bold tracking-tight text-white">Company Profile</h1>
        <p className="mt-2 text-sm text-neutral-400">This profile is stored per user and used to personalize generated plans.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-2">
          {(["manual", "text", "upload"] as InputMode[]).map((inputMode) => (
            <button
              key={inputMode}
              onClick={() => setMode(inputMode)}
              className={`rounded-full px-4 py-2 text-sm cursor-pointer ${
                mode === inputMode ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {inputMode === "manual" ? "Manual Form" : inputMode === "text" ? "Paste Text" : "Upload File"}
            </button>
          ))}
        </div>

        {mode === "manual" && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={company.name}
              onChange={(e) => setCompany((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Company name"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <input
              value={company.industry}
              onChange={(e) => setCompany((prev) => ({ ...prev, industry: e.target.value }))}
              placeholder="Industry"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <textarea
              value={toCommaText(company.preferredStack)}
              onChange={(e) => updateArrayField("preferredStack", e.target.value)}
              placeholder="Preferred stack (comma-separated)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white md:col-span-2"
              rows={2}
            />
            <textarea
              value={toCommaText(company.values)}
              onChange={(e) => updateArrayField("values", e.target.value)}
              placeholder="Values (comma-separated)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white md:col-span-2"
              rows={2}
            />
            <textarea
              value={toCommaText(company.constraints)}
              onChange={(e) => updateArrayField("constraints", e.target.value)}
              placeholder="Constraints (comma-separated)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white md:col-span-2"
              rows={2}
            />
            <textarea
              value={toCommaText(company.targetAudience)}
              onChange={(e) => updateArrayField("targetAudience", e.target.value)}
              placeholder="Target audience (comma-separated)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white md:col-span-2"
              rows={2}
            />
            <textarea
              value={toCommaText(company.designSystem)}
              onChange={(e) => updateArrayField("designSystem", e.target.value)}
              placeholder="Design system (comma-separated)"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white md:col-span-2"
              rows={2}
            />
            <button
              onClick={saveManual}
              disabled={!canSaveManual || saving}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black disabled:opacity-50 md:col-span-2 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}

        {mode === "text" && (
          <div className="mt-4 space-y-3">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste a plain text description of your company. Use lines like: Name: ..., Industry: ..., Preferred Stack: ..."
              className="min-h-60 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <button
              onClick={() => importTextOrJson("text", rawText)}
              disabled={!rawText.trim() || saving}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Importing..." : "Import from Text"}
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
              id="company-file-upload"
            />
            <label
              htmlFor="company-file-upload"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`flex min-h-56 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
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
              <p className="text-xs text-neutral-500">Detected JSON upload and imported it directly.</p>
            ) : (
              <p className="text-xs text-neutral-500">Upload `.json`, `.txt`, or `.md` files.</p>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            onClick={resetCompanyInfo}
            disabled={saving}
            className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Resetting..." : "Reset Company Info"}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {success && <p className="mt-4 text-sm text-green-400">{success}</p>}
      </section>
    </main>
  );
}

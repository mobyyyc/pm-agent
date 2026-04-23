"use client";

import { useEffect, useMemo, useState } from "react";

const QUESTION_STYLE_STORAGE_KEY = "pm-agent.question-style-level";

type QuestionStylePreset = {
  label: string;
  description: string;
  example: string;
};

const QUESTION_STYLE_PRESETS: Record<number, QuestionStylePreset> = {
  1: {
    label: "Simple",
    description: "Short, direct questions that quickly gather essentials before generating a plan.",
    example: "What is the one main outcome you want from this project?",
  },
  2: {
    label: "Focused",
    description: "Concise questions with light context checks around timeline and scope.",
    example: "What is your target launch window, and what feature matters most for v1?",
  },
  3: {
    label: "Balanced",
    description: "A mix of quick and strategic questions covering scope, constraints, and user impact.",
    example: "Who is the primary user, and what is the biggest delivery risk right now?",
  },
  4: {
    label: "Detailed",
    description: "Deeper follow-up questions to refine assumptions, dependencies, and execution details.",
    example: "What dependencies could delay delivery, and how should we sequence work around them?",
  },
  5: {
    label: "Deep Dive",
    description: "Thorough PM-style questioning for strategy, trade-offs, and edge-case planning.",
    example: "What trade-offs are acceptable between speed, quality, and scope if deadlines tighten?",
  },
};

const MIN_STYLE_LEVEL = 1;
const MAX_STYLE_LEVEL = 5;

export default function PreferencesSettings() {
  const [styleLevel, setStyleLevel] = useState(3);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(QUESTION_STYLE_STORAGE_KEY);
    const parsed = Number(stored);

    if (Number.isInteger(parsed) && parsed >= MIN_STYLE_LEVEL && parsed <= MAX_STYLE_LEVEL) {
      setStyleLevel(parsed);
    }

    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;

    window.localStorage.setItem(QUESTION_STYLE_STORAGE_KEY, String(styleLevel));

    setIsAnimating(true);
    const timer = window.setTimeout(() => {
      setIsAnimating(false);
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [styleLevel, hasLoaded]);

  const preset = useMemo(() => QUESTION_STYLE_PRESETS[styleLevel], [styleLevel]);
  const sliderPercent = ((styleLevel - MIN_STYLE_LEVEL) / (MAX_STYLE_LEVEL - MIN_STYLE_LEVEL)) * 100;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Perferences</h2>

      <div className="app-frame-item rounded-xl p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Style</p>
        <p className="mt-2 text-sm text-neutral-300">
          Control how simple or detailed the PM agent&apos;s clarifying questions should feel.
        </p>

        <div className="mt-5 px-1">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white transition-[width] duration-300 ease-in-out"
              style={{ width: `${sliderPercent}%` }}
            />
            <input
              id="question-style"
              type="range"
              min={MIN_STYLE_LEVEL}
              max={MAX_STYLE_LEVEL}
              step={1}
              value={styleLevel}
              onChange={(event) => setStyleLevel(Number(event.target.value))}
              className="settings-style-slider relative z-10 h-8 w-full appearance-none bg-transparent"
              aria-label="Question style level"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>Simple</span>
            <span>Detailed</span>
          </div>
        </div>

        <div
          className={`mt-5 rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-300 ease-in-out ${
            isAnimating ? "translate-y-0.5 opacity-80" : "translate-y-0 opacity-100"
          }`}
        >
          <p className="text-sm font-semibold text-white">Current style: {preset.label}</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">{preset.description}</p>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Example question</p>
          <p className="mt-1 text-sm italic text-neutral-200">&quot;{preset.example}&quot;</p>
        </div>
      </div>
    </div>
  );
}

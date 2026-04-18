"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import CodeRainBackground from "@/components/CodeRainBackground";
import { useGuest } from "@/components/GuestContext";

// Use local type for brevity if imports are tricky, but prefer importing
import type { AIAnalysis } from "@/types/models";

const PROJECT_KEYWORDS = [
  "project",
  "app",
  "web",
  "mobile",
  "platform",
  "feature",
  "user",
  "customer",
  "timeline",
  "deadline",
  "week",
  "month",
  "team",
  "developer",
  "design",
  "api",
  "database",
  "budget",
  "scope",
  "mvp",
  "ios",
  "android",
  "desktop",
  "software",
];

const NONSENSE_PATTERN = /^(idk|i\s*don'?t\s*know|asdf+|qwer+|test+|random|none|n\/a|\?+|\.+|\d+)$/i;
const MAX_HISTORY_MESSAGES = 10;
const MIN_PROGRESS_DELTA = 10;
const ANALYZE_REQUEST_TIMEOUT_MS = 22000;
const ANALYZE_MAX_ATTEMPTS = 2;

function isTransientAnalyzeStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 504);
}

function parseAnalyzeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request timed out. Please try again.";
  }

  if (error instanceof Error) {
    return error.message || "Something went wrong while analyzing.";
  }

  return "Something went wrong while analyzing.";
}

function assessAnswer(
  rawInput: string,
  currentQuestion?: string,
  currentOptions?: string[],
): { relevant: boolean; detailScore: number } {
  const input = rawInput.trim();
  if (!input) return { relevant: false, detailScore: 0 };

  const lowerInput = input.toLowerCase();
  if (NONSENSE_PATTERN.test(lowerInput)) {
    return { relevant: false, detailScore: 0 };
  }

  const words = lowerInput.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = input.length;

  const matchesKeyword = PROJECT_KEYWORDS.some((keyword) => lowerInput.includes(keyword));
  const matchesOption = !!currentOptions?.some((option) => option.toLowerCase() === lowerInput);
  const mentionsQuestionContext = !!currentQuestion && lowerInput.includes(currentQuestion.toLowerCase().split(" ")[0] || "");

  const relevant =
    matchesOption ||
    matchesKeyword ||
    mentionsQuestionContext ||
    wordCount >= 5 ||
    charCount >= 25;

  if (!relevant) {
    return { relevant: false, detailScore: 0 };
  }

  let detailScore = 1;
  if (wordCount >= 10) detailScore += 1;
  if (wordCount >= 20) detailScore += 1;
  if (wordCount >= 35) detailScore += 1;
  if (charCount >= 120) detailScore += 1;

  return { relevant: true, detailScore };
}

function progressDeltaFromDetail(detailScore: number): number {
  if (detailScore <= 1) return MIN_PROGRESS_DELTA;
  if (detailScore === 2) return MIN_PROGRESS_DELTA;
  if (detailScore === 3) return 14;
  if (detailScore === 4) return 20;
  return 26;
}

export default function CreateProjectPage() {
  const router = useRouter();
  const { isGuest, addGuestProject } = useGuest();
  
  // State
  const [inputValue, setInputValue] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [interviewProgress, setInterviewProgress] = useState(0);
  const [showInterviewProgress, setShowInterviewProgress] = useState(false);
  const [progressWarning, setProgressWarning] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const progressRef = useRef(0);
  const nonsenseStreakRef = useRef(0);

  useEffect(() => {
    progressRef.current = interviewProgress;
  }, [interviewProgress]);
  
  // History is needed for the API context, but we won't display it
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "model"; content: string }[]
  >([]);

  // Focus input automatically
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isAnalyzing && !isGenerating) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isAnalyzing, isGenerating, currentAnalysis]);

  useEffect(() => {
    if (!isAnalyzing) {
      setShowSlowHint(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSlowHint(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, [isAnalyzing]);

  const requestAnalysis = async (message: string, history: { role: "user" | "model"; content: string }[]) => {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= ANALYZE_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ANALYZE_REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch("/api/projects/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorBody = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
          const detail = errorBody?.detail || errorBody?.error || "Failed to analyze";
          const err = new Error(detail);

          if (!isTransientAnalyzeStatus(res.status) || attempt >= ANALYZE_MAX_ATTEMPTS) {
            throw err;
          }

          lastError = err;
          await new Promise((resolve) => setTimeout(resolve, attempt * 250));
          continue;
        }

        return (await res.json()) as AIAnalysis;
      } catch (error) {
        lastError = error;
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (attempt >= ANALYZE_MAX_ATTEMPTS || !isAbort) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to analyze");
  };

  const handleSend = async (content: string = inputValue) => {
    if (!content.trim() || isAnalyzing) return;

    const inputAssessment = assessAnswer(content, currentAnalysis?.question, currentAnalysis?.options);

    // 1. Set UI to "Analyzing" mode (clears previous question)
    setIsAnalyzing(true);
    setInputValue("");
    setCurrentAnalysis(null); // Clear displayed question to show loader
    setAnalyzeError(null);

    let nextProgress: number | null = null;
    let shouldHideAfterComplete = false;
    let shouldShowAfterThinking = false;

    try {
      const data = await requestAnalysis(content, conversationHistory.slice(-MAX_HISTORY_MESSAGES));

      if (data.status === "ready") {
        nextProgress = 100;
        shouldHideAfterComplete = true;
        nonsenseStreakRef.current = 0;
        setProgressWarning("");
      } else {
        shouldShowAfterThinking = true;

        if (inputAssessment.relevant) {
          const delta = progressDeltaFromDetail(inputAssessment.detailScore);
          nextProgress = Math.min(95, progressRef.current + delta);
          nonsenseStreakRef.current = 0;
          setProgressWarning("");
        } else {
          nextProgress = progressRef.current;
          nonsenseStreakRef.current += 1;
          if (nonsenseStreakRef.current >= 2) {
            setProgressWarning("Please provide project-related details so I can move forward.");
          }
        }
      }
      
      // 2. Update with new question/status
      setCurrentAnalysis(data);
      
      // Update history with user message + AI's question for next turn
      const updatedHistory = [...conversationHistory, { role: "user" as const, content }];
      if (data.question) {
        updatedHistory.push({ role: "model" as const, content: data.question });
      }
      setConversationHistory(updatedHistory);
      
    } catch (error) {
      console.error(error);
      setAnalyzeError(parseAnalyzeError(error));
    } finally {
      setIsAnalyzing(false);
      if (shouldShowAfterThinking) {
        setShowInterviewProgress(true);
      }
      if (nextProgress !== null) {
        requestAnimationFrame(() => {
          setInterviewProgress(nextProgress as number);
        });
      }
      if (shouldHideAfterComplete) {
        setTimeout(() => {
          setShowInterviewProgress(false);
        }, 900);
      }
    }
  };

  const handleCreateProject = async () => {
    if (!currentAnalysis?.summary) return;
    setIsGenerating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: currentAnalysis.summary }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const detail = errorBody?.detail || errorBody?.error || res.statusText;
        console.error("Create project failed:", res.status, detail);
        throw new Error(`Failed to create project: ${detail}`);
      }
      
      const data = await res.json();

      // Guest mode: store in context, navigate to guest project view
      if (isGuest && data.project && data.tasks) {
        addGuestProject(data.project, data.tasks);
        router.push(`/projects/${data.project.id}`);
        return;
      }

      if (data.project?.id) {
        window.location.href = `/projects/${data.project.id}`;
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to generate project.");
      setIsGenerating(false);
    }
  };

  // --- Render Logic ---

  // 1. Initial State: No analysis yet, no history
  const isInitial = conversationHistory.length === 0 && !isAnalyzing && !currentAnalysis;

  // 2. Loading State: isAnalyzing is true
  // (We render this separately)

  // 3. Question State: currentAnalysis.status === 'asking'
  const isAsking = !isAnalyzing && currentAnalysis?.status === "asking";

  // 4. Ready State: currentAnalysis.status === 'ready'
  const isReady = !isAnalyzing && currentAnalysis?.status === "ready";

  return (
    <div className="flex w-full min-h-[calc(100dvh-8rem)] flex-col items-center justify-center p-8 transition-colors duration-500 relative overflow-hidden isolate">
      <CodeRainBackground />
      <div className="w-full max-w-5xl flex flex-col items-center text-center space-y-8 justify-center relative z-10">

        {/* --- Loading View --- */}
        {isAnalyzing && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full"></div>
                    <Loader2 className="h-16 w-16 text-white animate-spin relative z-10" />
                </div>
                <p className="mt-8 text-white/50 text-xl font-light animate-pulse">Thinking...</p>
            {showSlowHint ? (
              <p className="mt-3 text-sm text-white/40">Still working. Large prompts may take a few extra seconds.</p>
            ) : null}
            </div>
        )}

        {/* --- Initial View --- */}
        {isInitial && (
          <div className="w-full max-w-2xl animate-in slide-in-from-bottom-4 fade-in duration-700">
            <h1 className="mb-4 bg-linear-to-b from-white to-transparent bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
              New Project
            </h1>
            <p className="mb-8 bg-transparent text-xl font-light text-white/60">
              Tell me what you want to build. I&apos;ll help you plan it.
            </p>
            
            <div className="relative group w-full">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="e.g. A mobile app for dog walkers..."
                    className="w-full bg-white/5 text-xl py-4 pl-8 pr-16 rounded-full text-white placeholder:text-white/20 focus:outline-none focus:bg-white/10 transition-all shadow-2xl"
                    autoFocus
                />
                <button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-black rounded-full hover:bg-white/90 disabled:opacity-0 disabled:pointer-events-none transition-all duration-300 shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
                >
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>

          </div>
        )}

        {/* --- Interview Question View --- */}
        {isAsking && currentAnalysis && (
           <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <h2 className="text-2xl font-medium leading-tight text-white md:text-3xl">
                {currentAnalysis.question}
              </h2>
              
              {/* Options Pills */}
              {currentAnalysis.options && currentAnalysis.options.length > 0 ? (
                  <div className="flex flex-wrap gap-3 justify-center py-4">
                      {currentAnalysis.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(opt)}
                            className="rounded-full bg-white/5 px-5 py-2 text-base text-white/90 transition-all hover:bg-white/10 hover:text-white cursor-pointer"
                          >
                            {opt}
                          </button>
                      ))}
                  </div>
              ) : null}

              <div className="relative group w-full flex flex-col items-center">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type your answer..."
                    className="w-full bg-transparent border-b-2 border-white/10 text-xl py-3 px-2 text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-all text-center mb-8"
                    autoFocus
                />

                <div className="flex gap-4">
                  <button
                      onClick={() => {
                          setConversationHistory([]);
                          setCurrentAnalysis(null);
                          setInputValue("");
                        setInterviewProgress(0);
                        setShowInterviewProgress(false);
                          nonsenseStreakRef.current = 0;
                        setProgressWarning("");
                      }}
                      className="rounded-full bg-white/5 px-6 py-3 text-base text-white/60 transition-all hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                      Cancel
                  </button>
                  <button
                      onClick={() => handleSend()}
                      disabled={!inputValue.trim()}
                      className="px-6 py-3 bg-white text-black rounded-full font-medium text-base hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

            </div>
           </div> 
        )}

        {/* --- Ready / Summary View --- */}
        {isReady && currentAnalysis && (
            <div className="w-full max-w-xl bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 text-center animate-in zoom-in-95 fade-in duration-500 shadow-2xl relative overflow-hidden flex flex-col items-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-green-500/0 via-green-500/50 to-green-500/0"></div>
                
                <div className="inline-flex items-center justify-center p-4 bg-green-500/20 rounded-full mb-6 relative">
                    <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full"></div>
                    <CheckCircle2 className="h-8 w-8 text-green-400 relative z-10" />
                </div>
                
                <h2 className="mb-4 text-3xl font-bold text-white">You&apos;re all set!</h2>
                <p className="text-xl text-white/70 mb-8 leading-relaxed">
                    {currentAnalysis.summary}
                </p>
                
                <button
                    onClick={handleCreateProject}
                    disabled={isGenerating}
                  className="flex w-full items-center justify-center gap-3 rounded-full bg-white py-5 text-xl font-bold text-black shadow-lg transition-all hover:bg-white/90 hover:shadow-xl active:scale-[0.98] cursor-pointer"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span>Building Plan...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-6 w-6" />
                            <span>Generate Project Plan</span>
                        </>
                    )}
                </button>
                <button 
                    onClick={() => {
                        window.location.reload();
                    }}
                    className="mt-6 text-white/40 hover:text-white text-sm transition-colors cursor-pointer"
                >
                    Start Over
                </button>
            </div>
        )}

        {showInterviewProgress && (
          <div className="w-full max-w-4xl space-y-2 mt-12">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
                style={{ width: `${interviewProgress}%` }}
              />
            </div>
            {progressWarning ? <p className="text-sm text-amber-300">{progressWarning}</p> : null}
          </div>
        )}

        {analyzeError ? (
          <div className="w-full max-w-2xl rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {analyzeError}
          </div>
        ) : null}

      </div>
    </div>
  );
}

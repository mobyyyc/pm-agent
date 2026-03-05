"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";

// Use local type for brevity if imports are tricky, but prefer importing
import type { AIAnalysis } from "@/types/models";

export default function CreateProjectPage() {
  const router = useRouter();
  
  // State
  const [inputValue, setInputValue] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  
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

  const handleSend = async (content: string = inputValue) => {
    if (!content.trim() || isAnalyzing) return;

    // 1. Update history state (hidden)
    const newHistory = [...conversationHistory, { role: "user" as const, content }];
    setConversationHistory(newHistory);
    
    // 2. Set UI to "Analyzing" mode (clears previous question)
    setIsAnalyzing(true);
    setInputValue("");
    setCurrentAnalysis(null); // Clear displayed question to show loader

    try {
      const res = await fetch("/api/projects/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: newHistory, // Send the updated history
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to analyze");
      }

      const data = (await res.json()) as AIAnalysis;
      
      // 3. Update with new question/status
      setCurrentAnalysis(data);
      
      // Update history with AI's question for next turn
      if (data.question) {
        setConversationHistory([...newHistory, { role: "model" as const, content: data.question }]);
      }
      
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setIsAnalyzing(false);
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

      if (!res.ok) throw new Error("Failed to create project");
      
      const data = await res.json();
      if (data.project?.id) {
        window.location.href = `/projects/${data.project.id}`;
      } else {
        router.push("/projects");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate project.");
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
    <div className="flex flex-1 flex-col items-center justify-center w-full min-h-[80vh] p-8 transition-colors duration-500">
      
      <div className="w-full max-w-3xl flex flex-col items-center text-center space-y-8 justify-center">

        {/* --- Loading View --- */}
        {isAnalyzing && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full"></div>
                    <Loader2 className="h-16 w-16 text-white animate-spin relative z-10" />
                </div>
                <p className="mt-8 text-white/50 text-xl font-light animate-pulse">Thinking...</p>
            </div>
        )}

        {/* --- Initial View --- */}
        {isInitial && (
          <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-bottom-4 fade-in duration-700">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-b from-white to-white/60 tracking-tight pb-2">
              New Project
            </h1>
            <p className="text-xl text-white/60 font-light">
              Tell me what you want to build. I'll help you plan it.
            </p>
            
            <div className="relative group w-full mt-8">
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
           <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight">
                {currentAnalysis.question}
              </h2>
              
              {/* Options Pills */}
              {currentAnalysis.options && currentAnalysis.options.length > 0 && (
                  <div className="flex flex-wrap gap-3 justify-center py-4">
                      {currentAnalysis.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(opt)}
                            className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 hover:text-white transition-all text-base cursor-pointer"
                          >
                            {opt}
                          </button>
                      ))}
                  </div>
              )}

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
                      }}
                      className="px-6 py-3 rounded-full border border-white/10 hover:bg-white/5 text-white/60 hover:text-white transition-all text-base cursor-pointer"
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
                
                <h2 className="text-3xl font-bold text-white mb-4">You're all set!</h2>
                <p className="text-xl text-white/70 mb-8 leading-relaxed">
                    {currentAnalysis.summary}
                </p>
                
                <button
                    onClick={handleCreateProject}
                    disabled={isGenerating}
                    className="w-full py-5 bg-white text-black rounded-2xl font-bold text-xl hover:bg-white/90 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
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

      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import { TeamProfile, TEAM_PROFILE_TABS, type TeamProfileTab } from "./TeamProfile";
import GithubAccountSettings from "./GithubAccount";

type SettingsTab = TeamProfileTab | "github-account";

export default function Settings() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    searchParams.get("github_link") ? "github-account" : "overview",
  );

  const handleTeamProfileTabChange = (tab: TeamProfileTab) => {
    setActiveTab(tab);
  };

  if (status === "loading") {
    return <div className="mx-auto max-w-5xl p-8 text-neutral-300">Loading settings...</div>;
  }

  if (!session?.user?.email) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="app-frame rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="mt-3 text-neutral-400">Sign in to manage your profile settings.</p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/settings" })}
            className="mt-6 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-white/90 cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-sm text-neutral-400">Manage your account settings and AI profile data.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="app-frame rounded-2xl p-4 lg:sticky lg:top-6 lg:self-start">
          <div className="mb-4 border-b border-white/10 pb-3">
            <p className="text-sm font-semibold text-white">{session.user?.name || "Your settings"}</p>
            <p className="mt-1 text-xs text-neutral-500">{session.user?.email || "Personal account"}</p>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Team Profile</p>
          <nav className="space-y-1" aria-label="Team profile sections">
            {TEAM_PROFILE_TABS.map((item) => {
              const isActive = activeTab === item.key;
              const isReset = item.key === "reset";
              const idleClass = isReset
                ? "settings-tab-reset"
                : "text-neutral-400 hover:bg-white/5 hover:text-white";
              const activeClass = isReset
                ? "settings-tab-reset settings-tab-reset-active"
                : "bg-white/10 text-white";

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                    isActive ? activeClass : idleClass
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs opacity-80">{item.description}</p>
                </button>
              );
            })}
          </nav>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Github</p>
          <nav className="space-y-1" aria-label="Github sections">
            <button
              type="button"
              onClick={() => setActiveTab("github-account")}
              className={`w-full rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                activeTab === "github-account"
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <p className="text-sm font-semibold">Account</p>
              <p className="text-xs opacity-80">Link your Github account</p>
            </button>
          </nav>
        </aside>

        <section className="app-frame self-start rounded-2xl p-5 sm:p-6">
          {activeTab === "github-account" ? (
            <GithubAccountSettings />
          ) : (
            <TeamProfile activeTab={activeTab} onChangeTab={handleTeamProfileTabChange} />
          )}
        </section>
      </div>
    </main>
  );
}

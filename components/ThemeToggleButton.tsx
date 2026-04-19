"use client";

import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

type ThemeToggleButtonProps = {
  className?: string;
};

const emptySubscribe = () => {
  return () => {};
};

function useHydrated() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function ThemeToggleButton({ className = "" }: ThemeToggleButtonProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const isLightMode = hydrated && resolvedTheme === "light";
  const nextTheme = isLightMode ? "dark" : "light";
  const buttonLabel = hydrated
    ? isLightMode
      ? "Switch to dark mode"
      : "Switch to light mode"
    : "Toggle theme";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={`theme-toggle-button ${className}`.trim()}
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      {isLightMode ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
      <span className="hidden sm:inline">{hydrated ? (isLightMode ? "Dark" : "Light") : "Theme"}</span>
    </button>
  );
}

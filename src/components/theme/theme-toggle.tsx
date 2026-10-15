"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme-script";

const ORDER: ThemePreference[] = ["light", "dark", "system"];
const LABEL: Record<ThemePreference, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System theme",
};

function apply(pref: ThemePreference) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {}
  return "system";
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    // Sync with the value the bootstrap script already applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(readStored());
  }, []);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${LABEL[pref]} (switch to ${LABEL[next].toLowerCase()})`}
      title={LABEL[pref]}
      onClick={() => {
        setPref(next);
        apply(next);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {}
      }}
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </Button>
  );
}

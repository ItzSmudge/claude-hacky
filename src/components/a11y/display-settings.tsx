"use client";

import { Accessibility } from "lucide-react";
import { useId, useSyncExternalStore } from "react";
import { CONTRAST_STORAGE_KEY, TEXT_SIZE_STORAGE_KEY } from "@/components/theme/theme-script";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Classes on <html>, and the storage key/values that remember them (applied before paint). */
const SETTINGS = {
  contrast: { className: "hc", key: CONTRAST_STORAGE_KEY, on: "high", off: "normal" },
  text: { className: "text-large", key: TEXT_SIZE_STORAGE_KEY, on: "large", off: "normal" },
} as const;
type Setting = keyof typeof SETTINGS;

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const isOn = (setting: Setting) =>
  document.documentElement.classList.contains(SETTINGS[setting].className);

function toggle(setting: Setting) {
  const { className, key, on, off } = SETTINGS[setting];
  const next = !isOn(setting);
  document.documentElement.classList.toggle(className, next);
  try {
    localStorage.setItem(key, next ? on : off);
  } catch {
    // Not remembered (private mode), but applies for this visit.
  }
  listeners.forEach((l) => l());
}

function useSetting(setting: Setting) {
  return useSyncExternalStore(
    subscribe,
    () => isOn(setting),
    () => false,
  );
}

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-hidden hc:focus-visible:ring-4";

function Switch({ setting, label, hint }: { setting: Setting; label: string; hint: string }) {
  const on = useSetting(setting);
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-hint`}
      onClick={() => toggle(setting)}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left hover:bg-muted hc:hover:bg-accent",
        RING,
      )}
    >
      <span className="flex flex-col">
        <span id={`${id}-label`} className="font-medium">
          {label}
        </span>
        <span id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </span>
      </span>
      {/* Track and thumb; "On"/"Off" is also shown in words, never by colour alone. */}
      <span className="flex shrink-0 items-center gap-2">
        <span aria-hidden className="w-6 text-right text-xs font-medium text-muted-foreground">
          {on ? "On" : "Off"}
        </span>
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors",
            on ? "border-primary bg-primary" : "border-foreground/40 bg-muted hc:border-foreground",
          )}
        >
          <span
            className={cn(
              "inline-block size-4 rounded-full transition-transform",
              on
                ? "translate-x-5 bg-primary-foreground"
                : "translate-x-0.5 bg-foreground/70 hc:bg-foreground",
            )}
          />
        </span>
      </span>
    </button>
  );
}

/** AX-04: high contrast and larger text, remembered on this device. Sits beside the theme toggle. */
export function DisplaySettings() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Display settings"
          title="Display settings"
          className="size-11"
        >
          <Accessibility className="size-5" strokeWidth={1.75} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2 hc:ring-2 hc:ring-border">
        <p className="px-3 pt-1 pb-2 font-display text-base font-semibold text-primary">Display</p>
        <div className="flex flex-col gap-1">
          <Switch setting="contrast" label="High contrast" hint="Stronger colours and borders" />
          <Switch setting="text" label="Larger text" hint="Makes everything about 20% bigger" />
        </div>
        <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
          Motion follows your device&apos;s reduced-motion setting.
        </p>
      </PopoverContent>
    </Popover>
  );
}

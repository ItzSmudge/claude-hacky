"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normaliseJoinCode } from "./join-code";

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden hc:focus-visible:ring-4";

/** One field: type a join code, go to /app/join/<CODE>, which does the joining. */
export function JoinCodeForm({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normaliseJoinCode(String(new FormData(event.currentTarget).get("code") ?? ""));
    if (!code) {
      // Clear first so the same message is announced again on a repeat attempt.
      setError("");
      requestAnimationFrame(() => setError("Join codes are 6 letters or numbers, like ABC234."));
      return;
    }
    setError("");
    router.push(`/app/join/${code}`);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={`${id}-code`} className="text-sm font-medium">
        Join code
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-code`}
          name="code"
          defaultValue={defaultValue}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn("min-h-11 max-w-48 font-mono text-lg tracking-widest uppercase", RING)}
        />
        <Button type="submit" className={cn("min-h-11 rounded-xl px-5", RING)}>
          Join
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

import type { Metadata } from "next";
import { JoinCodeForm } from "@/components/group/join-code-form";

export const metadata: Metadata = { title: "Join a group" };

// Owner: group (GR-01). Type the code a teammate shared.
export default function JoinWithCodePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-primary md:text-3xl">Join a group</h1>
      <p className="text-muted-foreground">
        Enter the code a teammate shared to swipe through the same project together.
      </p>
      <JoinCodeForm />
    </div>
  );
}

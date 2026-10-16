import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinCodeForm } from "@/components/group/join-code-form";
import { normaliseJoinCode } from "@/components/group/join-code";
import { JoinProject } from "@/components/group/join-project";

export const metadata: Metadata = { title: "Join a group" };

// Owner: group (GR-01). The invite link: joins the project on arrival, then opens its deck.
export default function JoinPage({ params }: PageProps<"/app/join/[code]">) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-primary md:text-3xl">Join a group</h1>
      <Suspense
        fallback={
          <p role="status" className="text-muted-foreground">
            Joining project…
          </p>
        }
      >
        <Join params={params} />
      </Suspense>
    </div>
  );
}

async function Join({ params }: Pick<PageProps<"/app/join/[code]">, "params">) {
  const code = normaliseJoinCode((await params).code);
  if (!code) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert">That link doesn&apos;t contain a valid join code. Type the code instead.</p>
        <JoinCodeForm />
      </div>
    );
  }
  return <JoinProject code={code} />;
}

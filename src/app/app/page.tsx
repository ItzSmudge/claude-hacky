import Link from "next/link";
import { NewProjectCard } from "@/components/projects/new-project-card";
import { OpenDemoButton } from "@/components/projects/open-demo-button";

// Owner: projects (PR-01). Start a project; the demo and join links stay for quick looks.
export default function ProjectsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl text-primary">Your projects</h1>
      <NewProjectCard />
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">Just want to look around?</p>
        <div className="flex flex-wrap gap-3">
          <OpenDemoButton />
        </div>
        <p className="text-muted-foreground">
          Have a join code from a teammate?{" "}
          <Link
            href="/app/join"
            className="rounded font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden"
          >
            Join their project
          </Link>
        </p>
      </div>
    </div>
  );
}

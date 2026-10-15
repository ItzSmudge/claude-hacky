import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fixtureProject } from "@/fixtures";

// Placeholder (F-13). Owner: projects (PR-01 new project flow).
export default function ProjectsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl text-primary">Your projects</h1>
      <p className="text-muted-foreground">
        Start a project with your research question or coursework brief. Until that flow lands, try
        the demo project.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/app/p/${fixtureProject.id}`}>Open demo project</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app/_styleguide">Styleguide</Link>
        </Button>
      </div>
    </div>
  );
}

import Link from "next/link";
import { OpenDemoButton } from "@/components/projects/open-demo-button";
import { Button } from "@/components/ui/button";

// Owner: projects. PR-01 adds the new project flow; until then the demo is the way in.
export default function ProjectsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl text-primary">Your projects</h1>
      <p className="text-muted-foreground">
        Start a project with your research question or coursework brief. Until that flow lands, try
        the demo project.
      </p>
      <div className="flex flex-wrap gap-3">
        <OpenDemoButton />
        <Button asChild variant="secondary" className="min-h-11">
          <Link href="/app/_styleguide">Styleguide</Link>
        </Button>
      </div>
    </div>
  );
}

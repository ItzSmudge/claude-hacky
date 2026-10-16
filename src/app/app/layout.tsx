import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { EnsureSession } from "@/components/projects/ensure-session";
import { MobileProjects } from "@/components/projects/mobile-projects";
import { loadProjects } from "@/components/projects/project-list";
import { ProjectNav } from "@/components/projects/project-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: projects (PR-02: history sidebar + anonymous sign-in).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-8">
        <div className="flex items-center gap-1">
          <Suspense fallback={null}>
            <Session />
          </Suspense>
          <Logo href="/app" className="min-h-11" />
        </div>
        <ThemeToggle />
      </header>
      <div className="flex flex-1">
        <div className="hidden w-72 shrink-0 flex-col gap-3 border-r border-border bg-sidebar p-4 text-sidebar-foreground md:flex">
          <h2 className="px-3 font-display text-lg font-semibold text-primary">Your projects</h2>
          <nav aria-label="Your projects">
            <Suspense fallback={<SidebarSkeleton />}>
              <Sidebar />
            </Suspense>
          </nav>
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

async function currentUserId() {
  // Request time only: supabase-js reads the clock to check token expiry.
  await connection();
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims.sub };
}

/** Starts a guest session if needed, and the phone-sized project sheet. */
async function Session() {
  const { userId } = await currentUserId();
  return (
    <>
      <EnsureSession signedIn={!!userId} />
      <MobileProjects userId={userId} />
    </>
  );
}

async function Sidebar() {
  const { supabase, userId } = await currentUserId();
  const projects = userId ? await loadProjects(supabase, userId) : [];
  if (!projects) {
    return <p className="px-3 text-sm text-muted-foreground">Couldn&apos;t load your projects.</p>;
  }
  return <ProjectNav projects={projects} userId={userId} />;
}

function SidebarSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">Loading your projects…</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} aria-hidden className="h-14 rounded-xl motion-reduce:animate-none" />
      ))}
    </div>
  );
}

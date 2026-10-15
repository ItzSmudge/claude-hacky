import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// Owner: projects (PR-02 adds the history sidebar + anonymous sign-in).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
        <Logo href="/app" />
        <ThemeToggle />
      </header>
      <div className="flex flex-1">
        <aside
          aria-label="Your projects"
          className="hidden w-64 shrink-0 border-r border-border bg-sidebar p-4 text-sidebar-foreground md:block"
        >
          <p className="text-sm text-muted-foreground">Your projects will appear here.</p>
        </aside>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

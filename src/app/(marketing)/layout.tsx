import { Logo } from "@/components/brand/logo";

// Owner: marketing (MK-*). Marketing pages stay static — no auth/session work here.
// The footer sits outside <main> so it is exposed as the contentinfo landmark.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-border bg-background px-4 py-8 text-sm text-muted-foreground md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Logo className="min-h-11" />
          <p>Real papers, honest summaries, citations you can trust.</p>
        </div>
      </footer>
    </>
  );
}

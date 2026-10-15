// Owner: marketing (MK-*). Marketing pages stay static — no auth/session work here.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return <main className="flex flex-1 flex-col">{children}</main>;
}

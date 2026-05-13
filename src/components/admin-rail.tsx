"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  glyph: string;
  badge?: string;
};

const RUNTIME_ITEMS: NavItem[] = [
  { label: "Debug Console", href: "/admin/debug", glyph: "D", badge: "live" },
  { label: "Memory Digest", href: "/admin/memory-digest", glyph: "M" },
  { label: "System / API", href: "/admin/system-api", glyph: "S" },
];

const KNOWLEDGE_ITEMS: NavItem[] = [
  {
    label: "Product Architecture",
    href: "/admin/architecture",
    glyph: "A",
  },
];

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-2 text-[10px] font-[780] uppercase tracking-[0.08em] text-[#7e8996]">
        {label}
      </span>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex min-h-[36px] items-center gap-2.5 rounded-lg px-2 text-[13px] font-[680] transition-colors",
              active
                ? "bg-[#2c3541] text-white"
                : "text-[#aab3c0] hover:bg-white/5 hover:text-white",
            )}
          >
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-white/20 text-[11px] font-[680] text-[#c8d0db]">
              {item.glyph}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-[720] text-[#c8d0db]">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminRail() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[238px] shrink-0 flex-col bg-[#1f252d] text-[#e4e7ec]">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="text-[18px] font-[760] leading-tight">FedOS Admin</div>
        <div className="text-[12px] text-[#7e8996]">Intelligence runtime</div>
      </div>

      <nav className="flex flex-col gap-6 flex-1 overflow-y-auto px-2 py-4">
        <NavGroup label="Runtime" items={RUNTIME_ITEMS} pathname={pathname} />
        <NavGroup label="Knowledge" items={KNOWLEDGE_ITEMS} pathname={pathname} />
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="grid grid-cols-2 gap-y-1 text-[12px]">
          <span className="text-[#7e8996]">Runtime</span>
          <span className="font-[680] text-[#c8d0db]">FedOS Home</span>
          <span className="text-[#7e8996]">Environment</span>
          <span className="font-[680] text-[#c8d0db]">Production</span>
        </div>
      </div>
    </aside>
  );
}

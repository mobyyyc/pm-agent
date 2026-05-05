"use client";

import Link from "next/link";

const LEGAL_PAGES = [
  {
    href: "/privacy",
    title: "Privacy Policy",
    description: "How we handle data, accounts, project content, and linked integrations.",
  },
  {
    href: "/cookies",
    title: "Cookie Policy",
    description: "What cookies and similar storage we use to keep the app working.",
  },
  {
    href: "/terms",
    title: "Terms of Service",
    description: "The usage rules, responsibilities, and expectations for the product.",
  },
] as const;

export default function LegalSettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Legal</h2>
      <p className="text-sm leading-relaxed text-neutral-300">
        All legal pages are grouped here so they live with your account settings instead of the main navigation.
      </p>

      <div className="space-y-3">
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="timeline-frame-item app-frame-item app-frame-hover block rounded-xl bg-white/5 p-4 transition-all duration-300 ease-in-out hover:bg-white/10"
          >
            <p className="text-base font-semibold text-white">{page.title}</p>
            <p className="mt-1 text-sm text-neutral-300">{page.description}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Open page</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

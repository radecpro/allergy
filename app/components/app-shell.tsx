import type { ReactNode } from "react";

import { AccountNav } from "./account-nav";
import { Notice } from "./notice";

type AppShellProps = {
  children: ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
  headerAction?: ReactNode;
  notice?: ReactNode;
  maxWidth?: "4xl" | "5xl" | "6xl";
};

const maxWidthClasses = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

export function AppShell({
  children,
  title,
  description,
  eyebrow = "Allergen Finder",
  headerAction,
  notice,
  maxWidth = "6xl",
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div
        className={`mx-auto flex w-full ${maxWidthClasses[maxWidth]} flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8`}
      >
        <header className="grid gap-3 border-b border-slate-200 pb-5 transition-colors duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
              {eyebrow}
            </p>
            <AccountNav />
          </div>
          {headerAction}
          <div className="grid gap-3 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
            {notice ? <Notice tone="warning">{notice}</Notice> : null}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}

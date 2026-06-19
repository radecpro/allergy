import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <section className="rounded-md border border-dashed border-slate-300 bg-white px-5 py-8">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <div className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
        {children}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

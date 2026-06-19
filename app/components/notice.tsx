import type { HTMLAttributes, ReactNode } from "react";

type NoticeTone = "warning" | "success" | "error" | "info" | "passive";

type NoticeProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  role?: "alert" | "status";
  tone?: NoticeTone;
};

const toneClasses: Record<NoticeTone, string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  passive: "border-slate-200 bg-white text-slate-600",
};

export function Notice({
  children,
  className = "",
  tone = "passive",
  ...props
}: NoticeProps) {
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm leading-6 transition-colors duration-150 ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

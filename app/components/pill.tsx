import type { HTMLAttributes, ReactNode } from "react";

type PillTone = "neutral" | "success" | "warning" | "danger" | "dark";

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: PillTone;
};

const toneClasses: Record<PillTone, string> = {
  neutral: "bg-slate-100 text-slate-800",
  success: "bg-emerald-100 text-emerald-950",
  warning: "bg-amber-100 text-amber-950",
  danger: "bg-rose-100 text-rose-950",
  dark: "bg-slate-950 text-white",
};

export function Pill({
  children,
  className = "",
  tone = "neutral",
  ...props
}: PillProps) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-sm font-medium ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

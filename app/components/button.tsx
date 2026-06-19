import type { ButtonHTMLAttributes } from "react";

type ButtonTone = "primary" | "secondary" | "danger" | "ghost-danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
};

const toneClasses: Record<ButtonTone, string> = {
  primary:
    "bg-emerald-800 text-white hover:bg-emerald-900 focus-visible:ring-emerald-200",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-200",
  danger:
    "bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-200",
  "ghost-danger":
    "border border-rose-300 bg-white text-rose-900 hover:bg-rose-50 focus-visible:ring-rose-200",
};

export function Button({
  tone = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}

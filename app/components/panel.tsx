import type { HTMLAttributes, ReactNode } from "react";

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
  children: ReactNode;
  tone?: "default" | "highlight" | "danger";
};

const toneClasses = {
  default: "border-slate-200 bg-white shadow-sm",
  highlight: "border-emerald-300 bg-emerald-50",
  danger: "border-rose-200 bg-rose-50",
};

export function Panel({
  as: Component = "section",
  children,
  className = "",
  tone = "default",
  ...props
}: PanelProps) {
  return (
    <Component
      className={`rounded-md border p-5 transition duration-150 ease-out ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

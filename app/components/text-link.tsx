import { Link } from "react-router";
import type { LinkProps } from "react-router";

type TextLinkProps = LinkProps & {
  tone?: "primary" | "muted";
};

export function TextLink({
  tone = "primary",
  className = "",
  ...props
}: TextLinkProps) {
  const toneClass =
    tone === "muted"
      ? "text-slate-600 hover:text-slate-950"
      : "font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950";

  return (
    <Link
      className={`text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${toneClass} ${className}`}
      {...props}
    />
  );
}

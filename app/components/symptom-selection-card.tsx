import type { ReactNode } from "react";

type SymptomSelectionCardProps = {
  children?: ReactNode;
  disabled?: boolean;
  helper?: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
  selected: boolean;
};

export function SymptomSelectionCard({
  children,
  disabled = false,
  helper,
  label,
  onChange,
  selected,
}: SymptomSelectionCardProps) {
  return (
    <article
      className={`overflow-hidden rounded-md border text-sm transition ${
        selected
          ? "border-emerald-600 bg-white text-slate-950 shadow-sm"
          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
      }`}
    >
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 font-medium">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onChange(event.currentTarget.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:cursor-not-allowed"
        />
        <span>{label}</span>
      </label>
      {selected ? (
        children
      ) : helper ? (
        <div className="border-t border-dashed border-slate-200 px-3 pb-3 pt-2 text-xs leading-5 text-slate-600">
          {helper}
        </div>
      ) : null}
    </article>
  );
}

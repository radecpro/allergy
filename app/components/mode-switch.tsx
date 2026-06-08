import { NavLink } from "react-router";

const modeLinks = [
  { to: "/", label: "Aktualne objawy", end: true },
  { to: "/destination", label: "Podróż", end: false },
] as const;

export function ModeSwitch() {
  return (
    <nav aria-label="Tryb sprawdzania alergii" className="flex">
      <div className="grid w-full grid-cols-2 rounded-md border border-slate-300 bg-white p-1 sm:w-auto">
        {modeLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex h-10 items-center justify-center rounded px-3 text-sm font-medium transition ${
                isActive
                  ? "bg-slate-950 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

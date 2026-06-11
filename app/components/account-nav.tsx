import { Form, Link, useLocation, useRouteLoaderData } from "react-router";

import type { RootLoaderData } from "~/root";

export function AccountNav() {
  const rootData = useRouteLoaderData("root") as RootLoaderData | undefined;
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  if (!rootData?.viewer) {
    return (
      <Link
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        className="text-sm font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950"
      >
        Zaloguj się
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="max-w-64 truncate text-slate-700">
        {rootData.viewer.email}
      </span>
      <Form action="/logout" method="post">
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950"
        >
          Wyloguj się
        </button>
      </Form>
    </div>
  );
}

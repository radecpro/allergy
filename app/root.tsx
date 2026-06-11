import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { createProductionAuthDependencies } from "~/domain/auth/dependencies.server";
import type { AuthSessionManager } from "~/domain/auth/session.server";

import type { Route } from "./+types/root";
import "./app.css";

export type RootLoaderData = {
  viewer: {
    email: string;
  } | null;
};

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function createRootLoader(sessions: AuthSessionManager) {
  return async function rootLoader(request: Request): Promise<Response> {
    const result = await sessions.getOptionalUser(request);

    return Response.json(
      {
        viewer: result.user
          ? {
              email: result.user.email,
            }
          : null,
      } satisfies RootLoaderData,
      { headers: result.headers },
    );
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  return createRootLoader(createProductionAuthDependencies().sessions)(request);
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

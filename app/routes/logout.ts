import type { Route } from "./+types/logout";
import { createLogoutAction } from "~/domain/auth/auth-route-handlers.server";
import { createProductionAuthDependencies } from "~/domain/auth/dependencies.server";

export async function loader() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function action({ request }: Route.ActionArgs) {
  return createLogoutAction(createProductionAuthDependencies())(request);
}

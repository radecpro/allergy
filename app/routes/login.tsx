import type { Route } from "./+types/login";
import { AuthForm } from "~/components/auth-form";
import { createAuthPageHandlers } from "~/domain/auth/auth-route-handlers.server";
import { createProductionAuthDependencies } from "~/domain/auth/dependencies.server";

export function meta() {
  return [{ title: "Allergen Finder | Logowanie" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return createAuthPageHandlers(
    "signIn",
    createProductionAuthDependencies(),
  ).loader(request);
}

export async function action({ request }: Route.ActionArgs) {
  return createAuthPageHandlers(
    "signIn",
    createProductionAuthDependencies(),
  ).action(request);
}

export default function Login() {
  return <AuthForm mode="login" />;
}

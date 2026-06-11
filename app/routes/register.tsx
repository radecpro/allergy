import type { Route } from "./+types/register";
import { AuthForm } from "~/components/auth-form";
import { createAuthPageHandlers } from "~/domain/auth/auth-route-handlers.server";
import { createProductionAuthDependencies } from "~/domain/auth/dependencies.server";

export function meta() {
  return [{ title: "Allergen Finder | Rejestracja" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return createAuthPageHandlers(
    "register",
    createProductionAuthDependencies(),
  ).loader(request);
}

export async function action({ request }: Route.ActionArgs) {
  return createAuthPageHandlers(
    "register",
    createProductionAuthDependencies(),
  ).action(request);
}

export default function Register() {
  return <AuthForm mode="register" />;
}

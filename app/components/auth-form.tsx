import { Form, Link, useActionData, useLoaderData } from "react-router";

import { Button } from "./button";
import { Notice } from "./notice";
import { Panel } from "./panel";
import { TextLink } from "./text-link";
import type { AuthActionData } from "~/domain/auth/auth-route-handlers.server";

type AuthFormProps = {
  mode: "register" | "login";
};

export function AuthForm({ mode }: AuthFormProps) {
  const loaderData = useLoaderData() as { returnTo: string };
  const actionData = useActionData() as AuthActionData | undefined;
  const isRegister = mode === "register";
  const alternativePath = isRegister ? "/login" : "/register";
  const alternativeLabel = isRegister
    ? "Masz już konto? Zaloguj się"
    : "Nie masz konta? Zarejestruj się";

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-slate-950">
      <Panel className="mx-auto grid w-full max-w-md gap-6 p-6 sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700">
            Allergen Finder
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {isRegister ? "Utwórz konto" : "Zaloguj się"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isRegister
              ? "Konto pozwoli zapisywać wyniki w kolejnych etapach aplikacji."
              : "Wróć do swoich funkcji konta bez blokowania testów gościnnych."}
          </p>
        </div>

        <Form
          method="post"
          action={isRegister ? "/register" : "/login"}
          className="grid gap-4"
        >
          <input
            type="hidden"
            name="returnTo"
            value={actionData?.values?.returnTo ?? loaderData.returnTo}
          />

          <label className="grid gap-1.5 text-sm font-medium">
            Adres e-mail
            <input
              type="email"
              name="email"
              autoComplete="email"
              defaultValue={actionData?.values?.email}
              aria-invalid={Boolean(actionData?.errors?.email)}
              className="h-11 rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              required
            />
            {actionData?.errors?.email ? (
              <span className="font-normal text-rose-700">
                {actionData.errors.email}
              </span>
            ) : null}
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Hasło
            <input
              type="password"
              name="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={10}
              maxLength={128}
              aria-invalid={Boolean(actionData?.errors?.password)}
              className="h-11 rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              required
            />
            {isRegister ? (
              <span className="font-normal text-slate-600">
                Od 10 do 128 znaków, bez dodatkowych wymagań składu.
              </span>
            ) : null}
            {actionData?.errors?.password ? (
              <span className="font-normal text-rose-700">
                {actionData.errors.password}
              </span>
            ) : null}
          </label>

          {actionData?.formError ? (
            <Notice role="alert" tone="error">{actionData.formError}</Notice>
          ) : null}

          <Button
            type="submit"
            className="h-11"
          >
            {isRegister ? "Utwórz konto" : "Zaloguj się"}
          </Button>
        </Form>

        <TextLink
          to={`${alternativePath}?returnTo=${encodeURIComponent(
            actionData?.values?.returnTo ?? loaderData.returnTo,
          )}`}
        >
          {alternativeLabel}
        </TextLink>
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-950">
          Wróć do testu gościnnego
        </Link>
      </Panel>
    </main>
  );
}

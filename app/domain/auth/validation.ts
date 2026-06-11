export type AuthFieldErrors = {
  email?: string;
  password?: string;
};

export type ValidatedCredentials = {
  email: string;
  password: string;
};

export type CredentialValidationResult =
  | { ok: true; credentials: ValidatedCredentials }
  | { ok: false; errors: AuthFieldErrors };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateCredentials(
  emailInput: FormDataEntryValue | null,
  passwordInput: FormDataEntryValue | null,
): CredentialValidationResult {
  const email = typeof emailInput === "string" ? normalizeEmail(emailInput) : "";
  const password = typeof passwordInput === "string" ? passwordInput : "";
  const errors: AuthFieldErrors = {};

  if (!emailPattern.test(email)) {
    errors.email = "Podaj poprawny adres e-mail.";
  }

  if (password.length < 10 || password.length > 128) {
    errors.password = "Hasło musi mieć od 10 do 128 znaków.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    credentials: { email, password },
  };
}

/** Validators for the sign-in form. `null` means valid. The Flutter version used `formz` for this. */

export function validateUsername(value: string): string | null {
  return value.trim() === "" ? "Enter your username" : null;
}

export function validatePassword(value: string): string | null {
  return value === "" ? "Enter your password" : null;
}

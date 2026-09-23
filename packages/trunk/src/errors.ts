/**
 * Base class for expected errors. Subclass it per error kind so `hasError(r, Cls)`
 * and `instanceof` work, and so a stack trace exists when one is ever thrown.
 *
 * ```ts
 * export class InvalidCredentials extends AppError {
 *   constructor() { super("Login or password is incorrect"); }
 * }
 * export class InvalidFormField extends AppError {
 *   constructor(readonly field: string, readonly details: string, cause?: unknown) {
 *     super(`Invalid field ${field}: ${details}`, cause);
 *   }
 * }
 * ```
 */
export abstract class AppError extends Error {
  constructor(
    message: string,
    /** The lower-level error this one was derived from, if any. */
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The call was rejected because the session is missing, expired or revoked.
 * The transport layer maps a 401 to it; `AuthHandler` recognises it among a
 * result's errors and hands the call to the host for re-authentication.
 */
export class ApiNotAuthorized extends AppError {
  constructor(message = "Not authorized", cause?: unknown) {
    super(message, cause);
  }
}

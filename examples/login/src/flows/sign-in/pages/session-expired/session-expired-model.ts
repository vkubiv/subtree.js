import { Rx } from "subtree.js/core";

export class SessionExpiredState {
  /** Who is signing in again; mirrored from the session. */
  readonly username = new Rx<string | null>(null);
  readonly password = new Rx("");
  readonly canSubmit = new Rx(false);
  readonly isSubmitting = new Rx(false);
  readonly errorMessage = new Rx<string | null>(null);
}

export abstract class SessionExpiredActions {
  abstract onPasswordChanged(value: string): void;
  /** Sign in again and retry the calls that were waiting. */
  abstract submit(): Promise<void>;
  /** Give up: cancel the waiting calls and sign out. */
  abstract signOut(): Promise<void>;
}

import { Rx, RxEvent } from "subtree.js/core";

export class LoginState {
  readonly username = new Rx("");
  readonly password = new Rx("");
  /** Validation messages; set once the field was touched. */
  readonly usernameError = new Rx<string | null>(null);
  readonly passwordError = new Rx<string | null>(null);
  /** Derived: both fields valid and nothing in flight. */
  readonly canSubmit = new Rx(false);
  readonly isSubmitting = new Rx(false);
  /** A sign-in attempt was rejected; the page shows the message as a toast. */
  readonly failed = new RxEvent<string>();
}

export abstract class LoginActions {
  abstract onUsernameChanged(value: string): void;
  abstract onPasswordChanged(value: string): void;
  abstract submit(): Promise<void>;
}

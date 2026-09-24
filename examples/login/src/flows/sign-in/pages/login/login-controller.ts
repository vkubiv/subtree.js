import { describeErrors, hasError } from "operation-result.js";
import { SubtreeController } from "subtree.js/core";
import { InvalidCredentials } from "../../../../backend-client";
import { signIn } from "../../../../core/ops/auth-ops";
import { validatePassword, validateUsername } from "../../../../core/primitives/credentials";
import type { SignInFlowDeps } from "../../sign-in-flow";
import { LoginActions, LoginState } from "./login-model";

export type LoginDeps = Pick<SignInFlowDeps, "authApi" | "authStorage" | "loggedinUser">;

export interface LoginRouting {
  onSignedIn(): void;
}

export class LoginController extends SubtreeController implements LoginActions {
  readonly state = new LoginState();

  constructor(
    readonly deps: LoginDeps,
    readonly routing: LoginRouting,
  ) {
    super();
    this.subtree.put(LoginState, this.state);
    this.subtree.put(LoginActions, this);

    this.sync(() => {
      this.state.canSubmit.value =
        validateUsername(this.state.username.value) === null &&
        validatePassword(this.state.password.value) === null &&
        !this.state.isSubmitting.value;
    }, [this.state.username, this.state.password, this.state.isSubmitting]);
  }

  onUsernameChanged = (value: string) => {
    this.state.username.value = value;
    this.state.usernameError.value = validateUsername(value);
  };

  onPasswordChanged = (value: string) => {
    this.state.password.value = value;
    this.state.passwordError.value = validatePassword(value);
  };

  submit = async () => {
    if (!this.state.canSubmit.value) return;
    this.state.isSubmitting.value = true;
    try {
      const r = await signIn({
        username: this.state.username.value,
        password: this.state.password.value,
        ...this.deps,
      });
      if (!r.ok) {
        this.state.failed.emit(
          hasError(r, InvalidCredentials) ? "Login or password is incorrect" : describeErrors(r.errors),
        );
        return;
      }
      this.routing.onSignedIn();
    } finally {
      this.state.isSubmitting.value = false;
    }
  };
}

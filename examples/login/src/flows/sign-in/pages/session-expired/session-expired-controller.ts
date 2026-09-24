import { describeErrors, hasError } from "operation-result.js";
import { SubtreeController } from "subtree.js/core";
import { InvalidCredentials } from "../../../../backend-client";
import { reauthenticate, signOut } from "../../../../core/ops/auth-ops";
import { validatePassword } from "../../../../core/primitives/credentials";
import type { SignInFlowDeps } from "../../sign-in-flow";
import { SessionExpiredActions, SessionExpiredState } from "./session-expired-model";

export type SessionExpiredDeps = Pick<
  SignInFlowDeps,
  "authApi" | "authStorage" | "loggedinUser" | "pendingReauth" | "profileRepository"
>;

export interface SessionExpiredRouting {
  onReauthenticated(): void;
  onSignedOut(): void;
}

export class SessionExpiredController extends SubtreeController implements SessionExpiredActions {
  readonly state = new SessionExpiredState();

  constructor(
    readonly deps: SessionExpiredDeps,
    readonly routing: SessionExpiredRouting,
  ) {
    super();
    this.subtree.put(SessionExpiredState, this.state);
    this.subtree.put(SessionExpiredActions, this);

    this.sync(() => {
      this.state.username.value = deps.loggedinUser.username;
    }, [deps.loggedinUser]);

    this.sync(() => {
      this.state.canSubmit.value =
        validatePassword(this.state.password.value) === null && !this.state.isSubmitting.value;
    }, [this.state.password, this.state.isSubmitting]);
  }

  onPasswordChanged = (value: string) => {
    this.state.password.value = value;
    this.state.errorMessage.value = null;
  };

  submit = async () => {
    if (!this.state.canSubmit.value) return;
    if (!this.deps.loggedinUser.isLoggedIn) {
      // Reached by URL without a session: nothing to re-authenticate.
      this.routing.onSignedOut();
      return;
    }
    this.state.isSubmitting.value = true;
    try {
      const r = await reauthenticate({ password: this.state.password.value, ...this.deps });
      if (!r.ok) {
        this.state.errorMessage.value = hasError(r, InvalidCredentials)
          ? "Login or password is incorrect"
          : describeErrors(r.errors);
        return;
      }
      this.routing.onReauthenticated();
    } finally {
      this.state.isSubmitting.value = false;
    }
  };

  signOut = async () => {
    await signOut(this.deps);
    this.routing.onSignedOut();
  };
}

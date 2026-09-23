import { useState } from "react";
import { Obs, useObserver, useRxEvent, useSubtree } from "subtree.js/react";
import { FieldError } from "../../../../ui/field-error";
import { LoginActions, LoginState } from "./login-model";

export function LoginPage() {
  const state = useSubtree(LoginState);
  const actions = useSubtree(LoginActions);
  const observer = useObserver();
  const [toast, setToast] = useState<string | null>(null);
  useRxEvent(state.failed, (message) => setToast(message ?? null));

  return (
    <main className="page">
      <h1>Sign in</h1>
      <label>
        Username
        <input
          value={observer.watch(state.username)}
          onChange={(e) => actions.onUsernameChanged(e.target.value)}
          autoComplete="username"
        />
      </label>
      <FieldError message={observer.watch(state.usernameError)} />
      <label>
        Password
        <input
          type="password"
          value={observer.watch(state.password)}
          onChange={(e) => actions.onPasswordChanged(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <FieldError message={observer.watch(state.passwordError)} />
      <Obs>
        {(ref) =>
          ref.watch(state.isSubmitting) ? (
            <p>Signing in…</p>
          ) : (
            <button type="button" disabled={!ref.watch(state.canSubmit)} onClick={actions.submit}>
              Sign in
            </button>
          )
        }
      </Obs>
      {toast !== null && <p role="alert">{toast}</p>}
      <p className="hint">Any username works. The password "fail" is rejected.</p>
    </main>
  );
}

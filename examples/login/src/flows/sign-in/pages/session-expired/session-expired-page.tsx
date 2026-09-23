import { Obs, useObserver, useSubtree } from "subtree.js/react";
import { FieldError } from "../../../../ui/field-error";
import { SessionExpiredActions, SessionExpiredState } from "./session-expired-model";

export function SessionExpiredPage() {
  const state = useSubtree(SessionExpiredState);
  const actions = useSubtree(SessionExpiredActions);
  const observer = useObserver();

  return (
    <main className="page">
      <h1>Session expired</h1>
      <p>
        Enter the password for <strong>{observer.watch(state.username) ?? "your account"}</strong> to continue
        where you left off.
      </p>
      <label>
        Password
        <input
          type="password"
          value={observer.watch(state.password)}
          onChange={(e) => actions.onPasswordChanged(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <FieldError message={observer.watch(state.errorMessage)} />
      <Obs>
        {(ref) =>
          ref.watch(state.isSubmitting) ? (
            <p>Signing in…</p>
          ) : (
            <>
              <button type="button" disabled={!ref.watch(state.canSubmit)} onClick={actions.submit}>
                Continue
              </button>
              <button type="button" onClick={actions.signOut}>
                Sign out
              </button>
            </>
          )
        }
      </Obs>
    </main>
  );
}

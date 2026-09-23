import { useObserver, useSubtree } from "subtree.js/react";
import { ProfileSection } from "../../sections/profile/profile-section";
import { HomeActions, HomeState } from "./home-model";

export function HomePage() {
  const state = useSubtree(HomeState);
  const actions = useSubtree(HomeActions);
  const observer = useObserver();

  return (
    <main className="page">
      <h1>Home</h1>
      <p>
        Signed in as <strong>{observer.watch(state.username)}</strong>
      </p>
      <ProfileSection />
      <button type="button" onClick={actions.expireSession}>
        Expire session (demo)
      </button>
      <button type="button" onClick={actions.signOut}>
        Sign out
      </button>
      <p className="hint">
        "Expire session" makes the server forget the token. The next "Reload" comes back with
        ApiNotAuthorized, AuthHandler parks the call, and the session-expired page retries it once you sign in
        again.
      </p>
    </main>
  );
}

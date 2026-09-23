import { useObserver, useSubtree } from "subtree.js/react";
import type { ProfileStatus } from "../../../../core/repositories/profile-repository";
import { ProfileSectionActions, ProfileSectionState } from "./profile-section-model";

export function ProfileSection() {
  const state = useSubtree(ProfileSectionState);
  const actions = useSubtree(ProfileSectionActions);
  const observer = useObserver();
  const status = observer.watch(state.status);

  return (
    <section className="profile">
      <h2>Profile</h2>
      <ProfileBody status={status} />
      <button type="button" onClick={actions.reload}>
        Reload
      </button>
    </section>
  );
}

function ProfileBody({ status }: { status: ProfileStatus }) {
  switch (status.kind) {
    case "idle":
    case "loading":
      return <p>Loading profile…</p>;
    case "loaded":
      return (
        <p data-testid="profile-name">
          {status.profile.firstName} {status.profile.lastName}
        </p>
      );
    case "error":
      return <p className="error">{status.message}</p>;
  }
}

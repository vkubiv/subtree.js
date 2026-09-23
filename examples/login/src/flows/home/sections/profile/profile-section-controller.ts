import { BaseController, type SubtreeModel } from "subtree.js/core";
import { loadProfile } from "../../../../core/ops/profile-ops";
import type { HomeDeps } from "../../pages/home/home-controller";
import { ProfileSectionActions, ProfileSectionState } from "./profile-section-model";

export type ProfileSectionDeps = Pick<HomeDeps, "userApi" | "authHandler" | "profileRepository">;

/**
 * A section of the home page. No own `SubtreeModel`: it registers into the
 * page's, mirrors the profile repository and triggers the first load.
 */
export class ProfileSectionController extends BaseController implements ProfileSectionActions {
  readonly state = new ProfileSectionState();

  constructor(
    subtree: SubtreeModel,
    readonly deps: ProfileSectionDeps,
  ) {
    super();
    subtree.put(ProfileSectionState, this.state);
    subtree.put(ProfileSectionActions, this);
    this.sync(() => {
      this.state.status.value = deps.profileRepository.status;
    }, [deps.profileRepository]);
    if (deps.profileRepository.status.kind === "idle") void loadProfile(deps);
  }

  reload = () => loadProfile(this.deps);
}

import { Rx } from "subtree.js/core";
import type { ProfileStatus } from "../../../../core/repositories/profile-repository";

export class ProfileSectionState {
  /** Mirrors the repository's status as is; the view switches on `kind`. */
  readonly status = new Rx<ProfileStatus>({ kind: "idle" });
}

export abstract class ProfileSectionActions {
  abstract reload(): Promise<void>;
}

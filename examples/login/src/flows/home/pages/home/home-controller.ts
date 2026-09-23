import { SubtreeController } from "subtree.js/core";
import { pick } from "trunk.js";
import { signOut } from "../../../../core/ops/auth-ops";
import type { HomeFlowDeps, HomeFlowRouting } from "../../home-flow";
import { ProfileSectionController } from "../../sections/profile/profile-section-controller";
import { HomeActions, HomeState } from "./home-model";

export type HomeDeps = HomeFlowDeps;
export type HomeRouting = HomeFlowRouting;

export class HomeController extends SubtreeController implements HomeActions {
  readonly state = new HomeState();
  /** A section: its own model and controller, registered into this page's subtree, disposed with it. */
  readonly profile: ProfileSectionController;

  constructor(
    readonly deps: HomeDeps,
    readonly routing: HomeRouting,
  ) {
    super();
    this.subtree.put(HomeState, this.state);
    this.subtree.put(HomeActions, this);
    this.profile = this.own(
      new ProfileSectionController(this.subtree, pick(deps, "userApi", "authHandler", "profileRepository")),
    );
    this.sync(() => {
      this.state.username.value = deps.loggedinUser.username;
    }, [deps.loggedinUser]);
  }

  signOut = async () => {
    await signOut(this.deps);
    this.routing.onSignedOut();
  };

  expireSession = () => {
    this.deps.demo.expireSessions();
  };
}

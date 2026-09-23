import { Rx, SubtreeController } from "subtree.js/core";
import type { AppDeps } from "./app-deps";
import { restoreSession } from "./core/ops/auth-ops";

export type SessionStage = "restoring" | "anonymous" | "signedIn";

export class AppState {
  readonly session = new Rx<SessionStage>("restoring");
  /** True while calls wait for the user to sign in again. */
  readonly reauthPending = new Rx(false);
}

export type AppControllerDeps = Pick<AppDeps, "authStorage" | "loggedinUser" | "pendingReauth">;

/**
 * The app root: restores the stored session, then mirrors the session and the
 * re-auth queue into state the router reads. No actions: the root only decides
 * which flow is on screen.
 */
export class AppController extends SubtreeController {
  readonly state = new AppState();

  constructor(readonly deps: AppControllerDeps) {
    super();
    this.subtree.put(AppState, this.state);
    void this.#start();
  }

  async #start(): Promise<void> {
    await restoreSession(this.deps);
    if (this.isDisposed) return;
    this.sync(() => this.#mirror(), [this.deps.loggedinUser, this.deps.pendingReauth]);
  }

  #mirror(): void {
    this.state.session.value = this.deps.loggedinUser.isLoggedIn ? "signedIn" : "anonymous";
    this.state.reauthPending.value = this.deps.pendingReauth.isPending;
  }
}

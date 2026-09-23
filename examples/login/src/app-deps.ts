import { AuthHandler } from "trunk.js";
import type { ApiContext, AuthApi, BackendClient, UserApi } from "./backend-client";
import type { AuthStorage } from "./core/auth/auth-storage";
import { LoggedinUser } from "./core/auth/loggedin-user";
import { PendingReauth } from "./core/auth/pending-reauth";
import { ProfileRepository } from "./core/repositories/profile-repository";

/** Knobs the demo backend exposes so the UI can provoke an expired session. */
export interface DemoControls {
  expireSessions(): void;
}

/**
 * Everything the app is made of, constructed once at startup. Flows and pages
 * declare the subset they need with `Pick<AppDeps, ...>` and receive it through
 * `pick()`.
 */
export interface AppDeps {
  readonly authApi: AuthApi;
  readonly userApi: UserApi;
  readonly authStorage: AuthStorage;
  readonly loggedinUser: LoggedinUser;
  readonly authHandler: AuthHandler<ApiContext>;
  readonly pendingReauth: PendingReauth;
  readonly profileRepository: ProfileRepository;
  readonly demo: DemoControls;
}

export function createAppDeps(o: {
  backend: BackendClient & DemoControls;
  authStorage: AuthStorage;
}): AppDeps {
  const loggedinUser = new LoggedinUser();
  const pendingReauth = new PendingReauth();
  const authHandler = new AuthHandler<ApiContext>({
    provider: loggedinUser,
    onAuthFailure: (call) => pendingReauth.add(call),
  });
  return {
    authApi: o.backend.auth,
    userApi: o.backend.user,
    authStorage: o.authStorage,
    loggedinUser,
    authHandler,
    pendingReauth,
    profileRepository: new ProfileRepository(),
    demo: o.backend,
  };
}

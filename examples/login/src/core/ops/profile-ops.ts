import type { AuthHandler } from "trunk.js";
import type { ApiContext, UserApi } from "../../backend-client";
import type { ProfileRepository } from "../repositories/profile-repository";

/**
 * Fetch the signed-in user's profile into the repository. Goes through
 * `AuthHandler`, so an expired session parks the call until the user signs in
 * again; the failure branch is reached only when they give up.
 */
export async function loadProfile(o: {
  userApi: UserApi;
  authHandler: AuthHandler<ApiContext>;
  profileRepository: ProfileRepository;
}): Promise<void> {
  if (o.profileRepository.status.kind === "loading") return; // single flight
  o.profileRepository.setLoading();
  const r = await o.authHandler.callApi((ctx) => o.userApi.me(ctx));
  if (!r.ok) {
    // Only reachable when the user gave up on re-authentication: the session is gone, and so is the profile.
    o.profileRepository.reset();
    return;
  }
  o.profileRepository.setProfile(r.value);
}

import { unwrap } from "operation-result.js";
import { describe, expect, it, vi } from "vitest";
import { createAppDeps } from "../../../../app-deps";
import { DemoBackend } from "../../../../backend-client/demo-backend";
import { MemoryAuthStorage } from "../../../../core/auth/auth-storage";
import { signIn } from "../../../../core/ops/auth-ops";
import { flush } from "../../../../testing/async";
import { ProfileSectionActions, ProfileSectionState } from "../../sections/profile/profile-section-model";
import { HomeController } from "./home-controller";
import { HomeActions, HomeState } from "./home-model";

async function setup() {
  const backend = new DemoBackend();
  const deps = createAppDeps({ backend, authStorage: new MemoryAuthStorage() });
  unwrap(await signIn({ username: "alice", password: "pw", ...deps }));
  const routing = { onSignedOut: vi.fn() };
  const controller = new HomeController(deps, routing);
  return { backend, deps, routing, controller, state: controller.state };
}

describe("HomeController", () => {
  it("registers its own and its section's state and actions", async () => {
    const { controller } = await setup();
    expect(controller.subtree.get(HomeState)).toBe(controller.state);
    expect(controller.subtree.get(HomeActions)).toBe(controller);
    expect(controller.subtree.get(ProfileSectionState)).toBe(controller.profile.state);
    expect(controller.subtree.get(ProfileSectionActions)).toBe(controller.profile);
  });

  it("mirrors the session and loads the profile through the section", async () => {
    const { controller, state } = await setup();
    await flush();
    expect(state.username.value).toBe("alice");
    expect(controller.profile.state.status.value).toEqual({
      kind: "loaded",
      profile: { id: "user-alice", firstName: "Alice", lastName: "Demo" },
    });
  });

  it("does not reload a profile the repository already has", async () => {
    const backend = new DemoBackend();
    const me = vi.spyOn(backend.user, "me");
    const deps = createAppDeps({ backend, authStorage: new MemoryAuthStorage() });
    unwrap(await signIn({ username: "alice", password: "pw", ...deps }));
    deps.profileRepository.setProfile({ id: "u", firstName: "Cached", lastName: "Profile" });

    const controller = new HomeController(deps, { onSignedOut: vi.fn() });
    await flush();

    expect(me).not.toHaveBeenCalled();
    expect(controller.profile.state.status.value.kind).toBe("loaded");
  });

  it("signOut clears the session and routes out", async () => {
    const { controller, deps, routing } = await setup();
    await flush();
    await controller.signOut();
    expect(deps.loggedinUser.isLoggedIn).toBe(false);
    expect(routing.onSignedOut).toHaveBeenCalledTimes(1);
  });

  it("expireSession makes the next reload park in pendingReauth", async () => {
    const { controller, deps } = await setup();
    await flush();
    controller.expireSession();
    const reload = controller.profile.reload();
    await flush();
    expect(deps.pendingReauth.count).toBe(1);
    deps.pendingReauth.cancelAll();
    await reload;
  });

  it("dispose tears down the section too", async () => {
    const { controller } = await setup();
    controller.dispose();
    expect(controller.profile.isDisposed).toBe(true);
  });
});

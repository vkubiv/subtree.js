import { unwrap } from "operation-result.js";
import { describe, expect, it, vi } from "vitest";
import { createAppDeps } from "../../../../app-deps";
import { DemoBackend } from "../../../../backend-client/demo-backend";
import { MemoryAuthStorage } from "../../../../core/auth/auth-storage";
import { signIn } from "../../../../core/ops/auth-ops";
import { loadProfile } from "../../../../core/ops/profile-ops";
import { flush } from "../../../../testing/async";
import { SessionExpiredController } from "./session-expired-controller";

async function setup() {
  const backend = new DemoBackend();
  const deps = createAppDeps({ backend, authStorage: new MemoryAuthStorage() });
  unwrap(await signIn({ username: "alice", password: "pw", ...deps }));
  backend.expireSessions();
  const load = loadProfile(deps); // parks itself in pendingReauth
  await flush();
  expect(deps.pendingReauth.count).toBe(1);

  const routing = { onReauthenticated: vi.fn(), onSignedOut: vi.fn() };
  const controller = new SessionExpiredController(deps, routing);
  await flush();
  return { controller, state: controller.state, deps, routing, load };
}

describe("SessionExpiredController", () => {
  it("shows who is signing in again", async () => {
    const { state } = await setup();
    expect(state.username.value).toBe("alice");
    expect(state.canSubmit.value).toBe(false);
  });

  it("submit with the right password retries the parked call and routes on", async () => {
    const { controller, deps, routing, load } = await setup();
    controller.onPasswordChanged("pw");
    await controller.submit();
    await load;

    expect(routing.onReauthenticated).toHaveBeenCalledTimes(1);
    expect(deps.pendingReauth.isPending).toBe(false);
    expect(deps.profileRepository.status.kind).toBe("loaded");
  });

  it("submit with a wrong password shows the error and keeps the call parked", async () => {
    const { controller, state, deps, routing } = await setup();
    controller.onPasswordChanged("fail");
    await controller.submit();

    expect(state.errorMessage.value).toBe("Login or password is incorrect");
    expect(routing.onReauthenticated).not.toHaveBeenCalled();
    expect(deps.pendingReauth.count).toBe(1);

    controller.onPasswordChanged("p");
    expect(state.errorMessage.value).toBeNull();
    deps.pendingReauth.cancelAll();
  });

  it("signOut cancels the parked call, clears the session and routes out", async () => {
    const { controller, deps, routing, load } = await setup();
    await controller.signOut();
    await load;

    expect(routing.onSignedOut).toHaveBeenCalledTimes(1);
    expect(deps.loggedinUser.isLoggedIn).toBe(false);
    expect(deps.pendingReauth.isPending).toBe(false);
    expect(deps.profileRepository.status.kind).toBe("idle");
  });
});

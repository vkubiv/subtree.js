import { unwrap } from "operation-result.js";
import { describe, expect, it } from "vitest";
import { createAppDeps } from "../../app-deps";
import { DemoBackend } from "../../backend-client/demo-backend";
import { flush } from "../../testing/async";
import { MemoryAuthStorage } from "../auth/auth-storage";
import { signIn } from "./auth-ops";
import { loadProfile } from "./profile-ops";

/** The whole auth story without React: op -> AuthHandler -> PendingReauth -> retry/cancel. */
describe("loadProfile", () => {
  async function signedIn() {
    const backend = new DemoBackend();
    const deps = createAppDeps({ backend, authStorage: new MemoryAuthStorage() });
    unwrap(await signIn({ username: "alice", password: "pw", ...deps }));
    return { backend, deps };
  }

  it("loads the profile into the repository", async () => {
    const { deps } = await signedIn();
    await loadProfile(deps);
    expect(deps.profileRepository.status).toEqual({
      kind: "loaded",
      profile: { id: "user-alice", firstName: "Alice", lastName: "Demo" },
    });
  });

  it("parks the call on an expired session and finishes it after re-auth", async () => {
    const { backend, deps } = await signedIn();
    backend.expireSessions();

    const load = loadProfile(deps);
    await flush();
    expect(deps.profileRepository.status.kind).toBe("loading");
    expect(deps.pendingReauth.count).toBe(1);

    unwrap(await signIn({ username: "alice", password: "pw", ...deps }));
    await deps.pendingReauth.retryAll();
    await load;

    expect(deps.profileRepository.status.kind).toBe("loaded");
    expect(deps.pendingReauth.isPending).toBe(false);
  });

  it("drops the profile when the user gives up on re-authentication", async () => {
    const { backend, deps } = await signedIn();
    backend.expireSessions();

    const load = loadProfile(deps);
    await flush();
    deps.pendingReauth.cancelAll();
    await load;

    expect(deps.profileRepository.status).toEqual({ kind: "idle" });
  });

  it("is single-flight: a second call while loading is a no-op", async () => {
    const { backend, deps } = await signedIn();
    backend.expireSessions();
    const first = loadProfile(deps);
    await flush();
    await loadProfile(deps);
    expect(deps.pendingReauth.count).toBe(1);
    deps.pendingReauth.cancelAll();
    await first;
  });
});

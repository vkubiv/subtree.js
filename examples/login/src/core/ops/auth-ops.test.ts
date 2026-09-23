import { fail, hasError, ok, unwrap } from "operation-result.js";
import { describe, expect, it, vi } from "vitest";
import type { AuthApi } from "../../backend-client";
import { DemoBackend } from "../../backend-client/demo-backend";
import { InvalidCredentials } from "../../backend-client/index";
import { MemoryAuthStorage } from "../auth/auth-storage";
import { LoggedinUser } from "../auth/loggedin-user";
import { PendingReauth } from "../auth/pending-reauth";
import { ProfileRepository } from "../repositories/profile-repository";
import { reauthenticate, restoreSession, signIn, signOut } from "./auth-ops";

function setup(authApi: AuthApi = new DemoBackend().auth) {
  return {
    authApi,
    authStorage: new MemoryAuthStorage(),
    loggedinUser: new LoggedinUser(),
    pendingReauth: new PendingReauth(),
    profileRepository: new ProfileRepository(),
  };
}

describe("restoreSession", () => {
  it("puts a stored session into loggedinUser", async () => {
    const o = setup();
    await o.authStorage.save({ token: "t", userId: "u", username: "alice" });
    await restoreSession(o);
    expect(o.loggedinUser.isLoggedIn).toBe(true);
    expect(o.loggedinUser.username).toBe("alice");
  });

  it("does nothing without a stored session", async () => {
    const o = setup();
    await restoreSession(o);
    expect(o.loggedinUser.isLoggedIn).toBe(false);
  });
});

describe("signIn", () => {
  it("stores the session and notifies on success", async () => {
    const o = setup();
    const listener = vi.fn();
    o.loggedinUser.addListener(listener);

    const r = await signIn({ username: "alice", password: "pw", ...o });

    expect(r.ok).toBe(true);
    expect(o.loggedinUser.username).toBe("alice");
    expect(await o.authStorage.load()).toMatchObject({ username: "alice" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await o.loggedinUser.authorizeCall()).toEqual({ token: "token-1" });
  });

  it("forwards InvalidCredentials and leaves the session untouched", async () => {
    const o = setup();
    const r = await signIn({ username: "alice", password: "fail", ...o });
    expect(hasError(r, InvalidCredentials)).toBe(true);
    expect(o.loggedinUser.isLoggedIn).toBe(false);
    expect(await o.authStorage.load()).toBeNull();
  });
});

describe("reauthenticate", () => {
  it("signs in with the current username and retries the waiting calls", async () => {
    const login = vi.fn(async (username: string, password: string) =>
      password === "fail" ? fail(new InvalidCredentials()) : ok({ token: `fresh-${username}`, userId: "u" }),
    );
    const o = setup({ login });
    o.loggedinUser.setAuthData({ token: "stale", userId: "u", username: "alice" });
    const call = { retry: vi.fn(async () => true), cancel: vi.fn() };
    o.pendingReauth.add(call);

    const r = await reauthenticate({ password: "pw", ...o });

    expect(r.ok).toBe(true);
    expect(login).toHaveBeenCalledWith("alice", "pw");
    expect(await o.loggedinUser.authorizeCall()).toEqual({ token: "fresh-alice" });
    expect(call.retry).toHaveBeenCalledTimes(1);
    expect(o.pendingReauth.isPending).toBe(false);
  });

  it("keeps the calls waiting when the password is wrong", async () => {
    const o = setup();
    o.loggedinUser.setAuthData({ token: "stale", userId: "u", username: "alice" });
    const call = { retry: vi.fn(async () => true), cancel: vi.fn() };
    o.pendingReauth.add(call);

    const r = await reauthenticate({ password: "fail", ...o });

    expect(hasError(r, InvalidCredentials)).toBe(true);
    expect(call.retry).not.toHaveBeenCalled();
    expect(o.pendingReauth.isPending).toBe(true);
  });

  it("throws without a session: that is a programming error, not an expected failure", async () => {
    const o = setup();
    await expect(reauthenticate({ password: "pw", ...o })).rejects.toThrow(/without a session/);
  });
});

describe("signOut", () => {
  it("cancels waiting calls, clears storage, session and profile", async () => {
    const o = setup();
    unwrap(await signIn({ username: "alice", password: "pw", ...o }));
    o.profileRepository.setProfile({ id: "u", firstName: "A", lastName: "B" });
    const call = { retry: vi.fn(async () => true), cancel: vi.fn() };
    o.pendingReauth.add(call);

    await signOut(o);

    expect(call.cancel).toHaveBeenCalledTimes(1);
    expect(o.pendingReauth.isPending).toBe(false);
    expect(await o.authStorage.load()).toBeNull();
    expect(o.loggedinUser.isLoggedIn).toBe(false);
    expect(o.profileRepository.status.kind).toBe("idle");
  });
});

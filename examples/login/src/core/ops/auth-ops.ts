import { type AsyncResult, ok } from "operation-result.js";
import type { AuthApi, InvalidCredentials } from "../../backend-client";
import type { AuthStorage } from "../auth/auth-storage";
import type { LoggedinUser } from "../auth/loggedin-user";
import type { PendingReauth } from "../auth/pending-reauth";
import type { ProfileRepository } from "../repositories/profile-repository";

/** Put the stored session, if any, into `loggedinUser`. */
export async function restoreSession(o: {
  authStorage: AuthStorage;
  loggedinUser: LoggedinUser;
}): Promise<void> {
  const data = await o.authStorage.load();
  if (data !== null) o.loggedinUser.setAuthData(data);
}

export async function signIn(o: {
  username: string;
  password: string;
  authApi: AuthApi;
  authStorage: AuthStorage;
  loggedinUser: LoggedinUser;
}): AsyncResult<void, InvalidCredentials> {
  const r = await o.authApi.login(o.username, o.password);
  if (!r.ok) return r;
  const data = { token: r.value.token, userId: r.value.userId, username: o.username };
  await o.authStorage.save(data);
  o.loggedinUser.setAuthData(data);
  return ok();
}

/** Sign the current user in again with a fresh password, then re-run every call that was waiting for it. */
export async function reauthenticate(o: {
  password: string;
  authApi: AuthApi;
  authStorage: AuthStorage;
  loggedinUser: LoggedinUser;
  pendingReauth: PendingReauth;
}): AsyncResult<void, InvalidCredentials> {
  const username = o.loggedinUser.username;
  if (username === null) throw new Error("reauthenticate() without a session");
  const r = await signIn({ ...o, username });
  if (!r.ok) return r;
  await o.pendingReauth.retryAll();
  return ok();
}

export async function signOut(o: {
  authStorage: AuthStorage;
  loggedinUser: LoggedinUser;
  pendingReauth: PendingReauth;
  profileRepository: ProfileRepository;
}): Promise<void> {
  o.pendingReauth.cancelAll();
  await o.authStorage.clear();
  o.loggedinUser.reset();
  o.profileRepository.reset();
}

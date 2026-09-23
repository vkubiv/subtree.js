import { ChangeNotifier } from "subtree.js/core";
import type { AuthContextProvider } from "trunk.js";
import type { ApiContext } from "../../backend-client";
import type { AuthData } from "./auth-storage";

/**
 * The session. Holds who is signed in and hands out the `ApiContext` for
 * authenticated calls. Notifies on sign-in and sign-out; controllers `sync` on it.
 */
export class LoggedinUser extends ChangeNotifier implements AuthContextProvider<ApiContext> {
  #auth: AuthData | null = null;

  get isLoggedIn(): boolean {
    return this.#auth !== null;
  }

  get username(): string | null {
    return this.#auth?.username ?? null;
  }

  get userId(): string | null {
    return this.#auth?.userId ?? null;
  }

  /** Calling an authenticated API without a session is a programming error, hence the throw. */
  async authorizeCall(): Promise<ApiContext> {
    if (this.#auth === null) throw new Error("authorizeCall() without a session");
    return { token: this.#auth.token };
  }

  setAuthData(data: AuthData): void {
    this.#auth = data;
    this.notifyListeners();
  }

  reset(): void {
    if (this.#auth === null) return;
    this.#auth = null;
    this.notifyListeners();
  }
}

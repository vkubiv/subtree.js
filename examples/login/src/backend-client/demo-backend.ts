import { type AsyncResult, fail, ok } from "operation-result.js";
import { ApiNotAuthorized } from "trunk.js";
import {
  type ApiContext,
  type AuthApi,
  type BackendClient,
  InvalidCredentials,
  type LoginResponse,
  type UserApi,
  type UserProfile,
} from "./index";

/**
 * An in-memory stand-in for the real backend-client that also plays the server:
 * it issues a token on login and forgets every token on `expireSessions()`, so
 * the app can show what `AuthHandler` does when a call comes back with
 * `ApiNotAuthorized`.
 *
 * Rules: any username signs in, except with the password "fail".
 */
export class DemoBackend implements BackendClient {
  readonly #latencyMs: number;
  /** token -> username */
  readonly #sessions = new Map<string, string>();
  #nextToken = 1;

  constructor(o: { latencyMs?: number } = {}) {
    this.#latencyMs = o.latencyMs ?? 0;
  }

  readonly auth: AuthApi = {
    login: async (username, password): AsyncResult<LoginResponse, InvalidCredentials> => {
      await this.#delay();
      if (password === "fail") return fail(new InvalidCredentials());
      const token = `token-${this.#nextToken++}`;
      this.#sessions.set(token, username);
      return ok({ token, userId: userIdOf(username) });
    },
  };

  readonly user: UserApi = {
    me: async (ctx: ApiContext): AsyncResult<UserProfile, ApiNotAuthorized> => {
      await this.#delay();
      const username = this.#sessions.get(ctx.token);
      if (username === undefined) return fail(new ApiNotAuthorized());
      return ok({ id: userIdOf(username), firstName: capitalize(username), lastName: "Demo" });
    },
  };

  /** Demo control: the server forgets every token. The next authenticated call fails with `ApiNotAuthorized`. */
  expireSessions(): void {
    this.#sessions.clear();
  }

  /** Zero latency resolves in a microtask, so tests can `await` a macrotask tick and see the outcome. */
  #delay(): Promise<void> {
    if (this.#latencyMs === 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.#latencyMs));
  }
}

function userIdOf(username: string): string {
  return `user-${username.toLowerCase()}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

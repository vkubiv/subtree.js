import { ChangeNotifier } from "subtree.js/core";
import type { PendingCall } from "trunk.js";

/**
 * The calls that hit `ApiNotAuthorized` and wait for the user to sign in again.
 * `AuthHandler.onAuthFailure` adds them; the session-expired page retries or
 * cancels them all at once. The app root watches `isPending` to show that page.
 */
export class PendingReauth extends ChangeNotifier {
  #calls: PendingCall[] = [];

  get isPending(): boolean {
    return this.#calls.length > 0;
  }

  get count(): number {
    return this.#calls.length;
  }

  add(call: PendingCall): void {
    this.#calls.push(call);
    this.notifyListeners();
  }

  /**
   * Re-run every pending call with the fresh session. A call that fails again
   * comes back through `add`, so the page shows up again.
   */
  async retryAll(): Promise<void> {
    const calls = this.#take();
    await Promise.all(calls.map((call) => call.retry()));
  }

  /** Give up: every caller receives the auth-failed result it was waiting on. */
  cancelAll(): void {
    for (const call of this.#take()) call.cancel();
  }

  #take(): PendingCall[] {
    if (this.#calls.length === 0) return [];
    const calls = this.#calls;
    this.#calls = [];
    this.notifyListeners();
    return calls;
  }
}

import { ChangeNotifier } from "subtree.js/core";
import type { UserProfile } from "../../backend-client";

export type ProfileStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly profile: UserProfile }
  | { readonly kind: "error"; readonly message: string };

/** Stores the signed-in user's profile and notifies. No logic: Ops write it, controllers `sync` on it. */
export class ProfileRepository extends ChangeNotifier {
  #status: ProfileStatus = { kind: "idle" };

  get status(): ProfileStatus {
    return this.#status;
  }

  setLoading(): void {
    this.#set({ kind: "loading" });
  }

  setProfile(profile: UserProfile): void {
    this.#set({ kind: "loaded", profile });
  }

  setError(message: string): void {
    this.#set({ kind: "error", message });
  }

  reset(): void {
    this.#set({ kind: "idle" });
  }

  #set(status: ProfileStatus): void {
    this.#status = status;
    this.notifyListeners();
  }
}

import { Rx } from "subtree.js/core";

export class HomeState {
  readonly username = new Rx<string | null>(null);
}

export abstract class HomeActions {
  abstract signOut(): Promise<void>;
  /** Demo: make the server forget the session so the next call fails with `ApiNotAuthorized`. */
  abstract expireSession(): void;
}

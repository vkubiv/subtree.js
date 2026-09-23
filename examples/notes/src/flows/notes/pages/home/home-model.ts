import { Rx, RxList } from "subtree.js/core";

export interface NoteItem {
  readonly id: string;
  readonly title: string;
}

export class HomeState {
  readonly isLoaded = new Rx(false);
  readonly items = new RxList<NoteItem>();
}

export abstract class HomeActions {
  abstract openNote(id: string): void;
  abstract addNote(): void;
  abstract deleteNote(id: string): Promise<void>;
}

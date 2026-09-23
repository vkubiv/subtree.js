import { SubtreeController } from "subtree.js/core";
import { deleteNote, loadNotes } from "../../../../core/ops/note-ops";
import type { NotesFlowDeps } from "../../notes-flow";
import { HomeActions, HomeState } from "./home-model";

export type HomeDeps = Pick<NotesFlowDeps, "notesApi" | "notesRepository">;

export interface HomeRouting {
  goToNote(id: string): void;
  goToAddNote(): void;
}

export class HomeController extends SubtreeController implements HomeActions {
  readonly state = new HomeState();

  constructor(
    readonly deps: HomeDeps,
    readonly routing: HomeRouting,
  ) {
    super();
    this.subtree.put(HomeState, this.state);
    this.subtree.put(HomeActions, this);

    // Now and whenever the repository changes: the editor's saves show up here without any wiring.
    this.sync(() => {
      this.state.isLoaded.value = deps.notesRepository.isLoaded;
      this.state.items.value = deps.notesRepository.notes.map((n) => ({
        id: n.id,
        title: n.title || "(untitled)",
      }));
    }, [deps.notesRepository]);

    if (!deps.notesRepository.isLoaded) void loadNotes(deps);
  }

  openNote = (id: string) => {
    this.routing.goToNote(id);
  };

  addNote = () => {
    this.routing.goToAddNote();
  };

  deleteNote = (id: string) => deleteNote({ id, ...this.deps });
}

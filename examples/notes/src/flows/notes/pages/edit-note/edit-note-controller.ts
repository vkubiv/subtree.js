import { SubtreeController } from "subtree.js/core";
import { createNote, getNote, updateNote } from "../../../../core/ops/note-ops";
import type { NotesFlowDeps } from "../../notes-flow";
import { EditNoteActions, EditNoteState } from "./edit-note-model";

/** The route parameter, validated by the flow before it gets here. `null` means a new note. */
export interface EditNoteParams {
  readonly noteId: string | null;
}

export type EditNoteDeps = Pick<NotesFlowDeps, "notesApi" | "notesRepository">;

export interface EditNoteRouting {
  goBack(): void;
}

export class EditNoteController extends SubtreeController implements EditNoteActions {
  readonly state: EditNoteState;

  constructor(
    readonly params: EditNoteParams,
    readonly deps: EditNoteDeps,
    readonly routing: EditNoteRouting,
  ) {
    super();
    this.state = new EditNoteState(params.noteId === null);
    this.subtree.put(EditNoteState, this.state);
    this.subtree.put(EditNoteActions, this);

    this.sync(() => {
      this.state.canSave.value = this.state.status.value === "ready" && this.state.title.value.trim() !== "";
    }, [this.state.status, this.state.title]);

    if (params.noteId === null) this.state.status.value = "ready";
    else void this.#load(params.noteId);
  }

  async #load(id: string): Promise<void> {
    const r = await getNote({ id, ...this.deps });
    if (this.isDisposed) return;
    if (!r.ok) {
      this.state.status.value = "notFound";
      return;
    }
    this.state.title.value = r.value.title;
    this.state.content.value = r.value.content;
    this.state.status.value = "ready";
  }

  onTitleChanged = (value: string) => {
    this.state.title.value = value;
  };

  onContentChanged = (value: string) => {
    this.state.content.value = value;
  };

  /** The view guards double clicks with `ref.disableUntilCompleted(actions.save)`. */
  save = async () => {
    if (!this.state.canSave.value) return;
    const draft = { title: this.state.title.value.trim(), content: this.state.content.value };
    if (this.params.noteId === null) {
      await createNote({ draft, ...this.deps });
    } else {
      const r = await updateNote({ id: this.params.noteId, draft, ...this.deps });
      if (!r.ok) {
        this.state.status.value = "notFound";
        return;
      }
    }
    this.routing.goBack();
  };

  cancel = () => {
    this.routing.goBack();
  };
}

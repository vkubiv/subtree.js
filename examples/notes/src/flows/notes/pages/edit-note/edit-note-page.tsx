import { Obs, useObserver, useSubtree } from "subtree.js/react";
import { EditNoteActions, EditNoteState } from "./edit-note-model";

export function EditNotePage() {
  const state = useSubtree(EditNoteState);
  const actions = useSubtree(EditNoteActions);
  const observer = useObserver();
  const status = observer.watch(state.status);

  return (
    <main className="page">
      <h1>{state.isNew ? "New note" : "Edit note"}</h1>
      {status === "loading" && <p>Loading…</p>}
      {status === "notFound" && (
        <>
          <p className="error">This note no longer exists.</p>
          <button type="button" onClick={actions.cancel}>
            Back
          </button>
        </>
      )}
      {status === "ready" && (
        <>
          <label>
            Title
            <input
              value={observer.watch(state.title)}
              onChange={(e) => actions.onTitleChanged(e.target.value)}
            />
          </label>
          <label>
            Note
            <textarea
              rows={6}
              value={observer.watch(state.content)}
              onChange={(e) => actions.onContentChanged(e.target.value)}
            />
          </label>
          <Obs>
            {(ref) => {
              // `undefined` while a save is in flight: the button is disabled until it completes.
              const save = ref.disableUntilCompleted(actions.save);
              return (
                <button
                  type="button"
                  disabled={save === undefined || !ref.watch(state.canSave)}
                  onClick={save}
                >
                  {save === undefined ? "Saving…" : "Save"}
                </button>
              );
            }}
          </Obs>
          <button type="button" onClick={actions.cancel}>
            Cancel
          </button>
        </>
      )}
    </main>
  );
}

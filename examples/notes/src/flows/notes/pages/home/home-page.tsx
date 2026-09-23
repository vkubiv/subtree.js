import { useObserver, useSubtree } from "subtree.js/react";
import { HomeActions, HomeState } from "./home-model";

export function HomePage() {
  const state = useSubtree(HomeState);
  const actions = useSubtree(HomeActions);
  const observer = useObserver();

  const isLoaded = observer.watch(state.isLoaded);
  const items = observer.watch(state.items);

  return (
    <main className="page">
      <h1>Notes</h1>
      <button type="button" onClick={actions.addNote}>
        New note
      </button>
      {!isLoaded && <p>Loading…</p>}
      {isLoaded && items.length === 0 && <p className="hint">No notes yet.</p>}
      <ul className="notes">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="link" onClick={() => actions.openNote(item.id)}>
              {item.title}
            </button>
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              onClick={() => actions.deleteNote(item.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

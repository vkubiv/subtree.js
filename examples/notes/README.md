# Example: notes

The port of `subtree/full_examples/notes_app`: a list of notes and an editor. Smaller than
the login example; it shows the data path (API, repository, ops, `sync`) and route
parameters as controller identity. The other acceptance test of
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

```
npm install            # at the repository root
npm run dev -w example-notes
npm test  -w example-notes
```

## Layout

```
src/
  backend-client/         NotesApi contract, NoteNotFound, InMemoryNotesApi
  core/
    repositories/         NotesRepository (the notes the app has seen)
    ops/                  loadNotes, getNote, createNote, updateNote, deleteNote
  app-deps.ts             AppDeps + createAppDeps()
  app.tsx                 renders the flow
  flows/notes/            NotesFlow: HomePage (list), EditNotePage (new or existing)
```

## What it demonstrates

| Rule | Where |
|---|---|
| `sync` from a repository | `HomeController` mirrors `NotesRepository` into `HomeState.items`; a save in the editor shows up in the list with no event wiring. The Flutter example needed a `ControllerNotifier` for this. |
| Ops write repositories | Every op in `core/ops/note-ops.ts` updates `NotesRepository` after the API call; `getNote` serves from it when it can. |
| Route params as identity | `note/:id` renders `<Subtree deps={[id]}>`, so `/note/a` and `/note/b` get different controllers; the page never calls `useParams`. |
| A missing entity is state | `EditNoteState.status` is `"notFound"`, not an exception. |
| Double-submit guard in the view | The Save button uses `ref.disableUntilCompleted(actions.save)`. |
| Route identity | Sibling routes give their `<Subtree>` a `key` (see `notes-flow.tsx`). |

## Tests

Ops (`core/ops/note-ops.test.ts`), controllers (`*-controller.test.ts`), pages
(`*-page.test.tsx` with `<SubtreeProvider>`), and the flow (`app.test.tsx` in a
`MemoryRouter`, StrictMode on).

import { Route, Routes, useNavigate, useParams } from "react-router";
import { Subtree } from "subtree.js/react";
import type { AppDeps } from "../../app-deps";
import { EditNoteController } from "./pages/edit-note/edit-note-controller";
import { EditNotePage } from "./pages/edit-note/edit-note-page";
import { HomeController } from "./pages/home/home-controller";
import { HomePage } from "./pages/home/home-page";

export type NotesFlowDeps = Pick<AppDeps, "notesApi" | "notesRepository">;

/**
 * The list and the editor. Each `<Subtree>` gets a `key` because sibling routes
 * render at the same position in the React tree; the editor for an existing note
 * also passes `deps={[id]}` so `/note/a` and `/note/b` get different controllers.
 */
export function NotesFlow({ deps }: { deps: NotesFlowDeps }) {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route
        index
        element={
          <Subtree
            key="home"
            controller={() =>
              new HomeController(deps, {
                goToNote: (id) => navigate(`/note/${encodeURIComponent(id)}`),
                goToAddNote: () => navigate("/note/new"),
              })
            }
          >
            <HomePage />
          </Subtree>
        }
      />
      <Route
        path="note/new"
        element={
          <Subtree
            key="new"
            controller={() => new EditNoteController({ noteId: null }, deps, { goBack: () => navigate("/") })}
          >
            <EditNotePage />
          </Subtree>
        }
      />
      <Route path="note/:id" element={<EditNoteRoute deps={deps} />} />
    </Routes>
  );
}

/** Reads the route parameter once and hands it to the controller; the page never calls `useParams`. */
function EditNoteRoute({ deps }: { deps: NotesFlowDeps }) {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <Subtree
      key="edit"
      deps={[id]}
      controller={() => new EditNoteController({ noteId: id ?? null }, deps, { goBack: () => navigate("/") })}
    >
      <EditNotePage />
    </Subtree>
  );
}

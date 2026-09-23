import type { AppDeps } from "./app-deps";
import { NotesFlow } from "./flows/notes/notes-flow";

/** Render inside a router (`BrowserRouter` in `main.tsx`, `MemoryRouter` in tests). */
export function App({ deps }: { deps: AppDeps }) {
  return <NotesFlow deps={deps} />;
}

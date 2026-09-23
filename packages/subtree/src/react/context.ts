import { createContext } from "react";
import type { SubtreeModel } from "../core/model";

export const SubtreeModelContext = createContext<SubtreeModel | null>(null);

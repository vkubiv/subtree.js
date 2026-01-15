import React from "react";
import {ModelIdentifier, SubtreeModel} from "./model";

export const SubtreeModelContext = React.createContext<SubtreeModel | null>(null);

export function useSubtree<T>(indetifier: ModelIdentifier<T>): T {
  const subtreeModel = React.useContext(SubtreeModelContext);
  if (subtreeModel) {
    return subtreeModel.get(indetifier);
  }

  throw new Error(
    `Looks like you are trying to use subtree model outside of subtree.`
  );
}
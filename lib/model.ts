export interface Newable<T> {
  new(...args: any[]): T;
}

export interface Abstract<T> {
  prototype: T;
}

export type ModelIdentifier<T> = (string | symbol | Newable<T> | Abstract<T>);

export class SubtreeModel {
  private _modelMap: Map<ModelIdentifier<any>, any>;

  constructor() {
    this._modelMap = new Map<ModelIdentifier<any>, any>();
  }

  put<T>(identifier: ModelIdentifier<T>, instance: T): T {
    this._modelMap.set(identifier, instance);
    return instance;
  }

  get<T>(identifier: ModelIdentifier<T>): T {
    const instance = this._modelMap.get(identifier);
    if (instance) {
      return instance;
    }

    throw new Error(
      `Type ${identifier.toString()} is not found in subtree view model. `
      + '\n(Did you forget to put it in subtree controller?)');
  }
}



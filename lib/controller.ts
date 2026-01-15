import {SubtreeModel} from "./model";

export abstract class SubtreeController {
  public get subtree(): SubtreeModel {
    return this._subtree;
  }

  autoDispose(items: (() => void)[] | (() => void)): void {
    if (Array.isArray(items)) {
      items.forEach((item) => this._onDestroyCallbacks.push(item));
    } else {
      this._onDestroyCallbacks.push(items);
    }
  }

  dispose(): void {
    this._onDestroyCallbacks.forEach((callback) => callback());
    this._onDestroyCallbacks = [];
  }

  private _onDestroyCallbacks: (() => void)[] = [];
  private _subtree = new SubtreeModel();
}
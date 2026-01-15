export interface Listenable {
  addListener(listener: () => void): void;
  removeListener(listener: () => void): void;
}

export class ChangeNotifier implements Listenable {
  private _listeners: Array<(() => void) | null> = [];

  protected notifyListeners() {
    for (const listener of this._listeners) {
      if (listener) {
        listener();
      }
    }
  }

  
  addListener(listener: () => void) {
    for (let i = 0; i < this._listeners.length; i++) {
      if (this._listeners[i] == null) {
        this._listeners[i] = listener;
        return;
      }
    }
    this._listeners.push(listener);
  }

  removeListener(listener: () => void) {
    for (let i = 0; i < this._listeners.length; i++) {
      if (this._listeners[i] === listener) {
        this._listeners[i] = null;
        return;
      }
    }
  }
}

export interface ValueListenable<T> extends Listenable {
  get snapshot(): T;
}

export class Rx<T> extends ChangeNotifier implements ValueListenable<T> {
  private _value: T;

  constructor(value: T) {
    super();
    this._value = value;
  }

  get snapshot(): T {
    return this._value;
  }

  get value(): T {
    throw new Error("Use 'snapshot' to get the value of Rx in controller or `observer.watch`" +
      " to get value and subscribe to changes in react component.");
  }
  
  set value(value: T) {
    if (value !== this._value) {
      this._value = value;
      this.notifyListeners();
    }
  }
  
  update(fn: (value: T) => T) {
    const newValue = fn(this._value);
    if (newValue !== this._value) {
      this._value = newValue;
      this.notifyListeners();
    }
  }
}
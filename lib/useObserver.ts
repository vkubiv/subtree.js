import {Listenable, ValueListenable} from "./rx";
import {useEffect, useReducer,  useState} from "react";

export interface ObserverRef {
  watch<T>(observable: ValueListenable<T>): T;
}

export class Observer {
  private _observables: Array<Listenable> = [];
  private _forceUpdate: (() => void) | null;

  constructor(forceUpdate: () => void) {
    this._forceUpdate = forceUpdate;
  }

  watch<T>(observable: ValueListenable<T>): T {
    if (!this._observables.includes(observable)) {
      if (this._forceUpdate) {
        observable.addListener(this._forceUpdate);
      }
      this._observables.push(observable);
    }

    return observable.snapshot;
  }


  dispose() {
    if (this._forceUpdate) {
      for (const observable of this._observables) {
        observable.removeListener(this._forceUpdate);
      }
    }    

    this._observables = [];
  }

  setForceUpdate(forceUpdate: (() => void) | null) {
    if (this._forceUpdate === forceUpdate) {
      return;
    }

    if (this._forceUpdate) {
      for (const observable of this._observables) {
        observable.removeListener(this._forceUpdate);
      }
    }    
    
    this._forceUpdate = forceUpdate;

    if (this._forceUpdate) {
      for (const observable of this._observables) {
        observable.addListener(this._forceUpdate);
      }
    }
  }
  
}

export function useObserver(): Observer {
  const [, forceUpdate] = useReducer(() => [], []);


  /*const observerRef = useRef<Observer | null>(null);
  if (observerRef.current == null) {
    observerRef.current = new Observer(forceUpdate);
  }*/
  
  const [observer] = useState(() => new Observer(forceUpdate));

  useEffect(() => {       
    observer.setForceUpdate(forceUpdate);
    return () => {
      observer.setForceUpdate(null);
    }
  }, []);

  return observer;
}
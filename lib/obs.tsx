import React from "react";
import {Observer, ObserverRef} from "./useObserver";

export interface ObsProps {
  render: (ref: ObserverRef) => React.ReactNode;
}

export class ObsComponent extends React.Component <ObsProps> {
  private _observer: Observer;

  constructor(props: ObsProps) {
    super(props);
    this._observer = new Observer(this.forceUpdate.bind(this));
  }

  _forceUpdate = () => {
    this.forceUpdate();
  }

  render(): React.ReactNode {
    return this.props.render(this._observer);
  }

  componentDidMount(): void {
    this._observer.setForceUpdate(this._forceUpdate);
  }

  componentWillUnmount(): void {
    this._observer.dispose();
  }
}

export function obs(render: (ref: ObserverRef) => React.ReactNode): React.ReactNode {
  return <ObsComponent render={ref => render(ref)}/>;
}
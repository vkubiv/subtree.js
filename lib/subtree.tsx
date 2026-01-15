import React from "react";
import {SubtreeController} from "./controller";
import {SubtreeModelContext} from "./useSubtree";

export interface SubtreeProps {
  controller: () => SubtreeController;
  children: React.ReactNode;
}



export function Subtree(props: SubtreeProps) {
  const [controller, ] 
    = React.useState<SubtreeController>(props.controller);
  
  React.useEffect(() => {        
    return () => {
      controller.dispose();      
    };
  }, [controller, props]);
  
  
  return (
    <SubtreeModelContext.Provider value={controller.subtree}>
      {props.children}
    </SubtreeModelContext.Provider>
  );
}
/*
interface SubtreeState {
  controller: SubtreeController | null;
}

export class Subtree extends React.Component<SubtreeProps, SubtreeState> {
  
  state :SubtreeState = {
    controller: null
  };
  constructor(props: SubtreeProps) {
    super(props);    
  }

  componentWillUnmount(): void {
    this.state.controller?.dispose();
    this.setState({
      controller: null
    });
  }

  componentDidMount(): void {
    if (!this.state.controller) {
      this.setState({
        controller: this.props.controller()
      });
    }      
  }


  render(): React.ReactNode {
    const controller = this.state.controller;
    if (!controller) {
      return (
        <></>
      );
    }
    
    return (
      <SubtreeModelContext.Provider value={controller.subtree}>
        {this.props.children}
      </SubtreeModelContext.Provider>
    );
  }  
}*/
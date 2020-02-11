import { Graph, Maybe, GetNodeArgs, TransitionResult } from "./graph-types";



export interface GraphAlgorithmInstance<G extends Graph<G>> {
    beginNavigation<CurrentNode extends keyof G['nodes'], TargetNode extends keyof G['nodes']>(navArgs: {
        currentNode: CurrentNode,
        targetNode: TargetNode,
    } & (GetNodeArgs<G, TargetNode> extends never ? {} : { targetNodeArg: GetNodeArgs<G, TargetNode> })): void;

    chooseNextEdge<CurrentNode extends keyof G['nodes'], TargetNode extends keyof G['nodes']>(navArgs: {
        currentNode: CurrentNode,
        targetNode: TargetNode
    } & (GetNodeArgs<G, TargetNode> extends never ? {} : { targetNodeArg: GetNodeArgs<G, TargetNode> })): Maybe<keyof G['nodes'][CurrentNode]['edges']>;

    postEdgeTransitionAttempt<CurrentNode extends keyof G['nodes'], PrevNode extends keyof G['nodes'], TargetNode extends keyof G['nodes']>(navArgs: {
        currentNode: CurrentNode,
        previousNode: PrevNode,
        targetNode: TargetNode,
        transitionResult: TransitionResult<G>
    }): void;

    endNavigation(): void;
}

export type GraphAlgorithm<G extends Graph<G>> = {
    createInstance(graph: G, initialNode: keyof G['nodes']): GraphAlgorithmInstance<G>
};

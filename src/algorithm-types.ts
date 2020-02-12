import { Graph, Maybe, GetNodeArgs, TransitionResult } from "./graph-types";

type NavigableEdges<G extends Graph<G>> = { [Node in keyof G['nodes']]: { [E in keyof G['nodes'][Node]['edges']]: { navigable: boolean } } };

export type GraphNavigationResult<G extends Graph<G>, SuccessType> =
    | ({
        type: 'successful',
    } & SuccessType)
    /** Attempted navigation to the target node, however the pathing algorithm has
     * determined that the target node is unreachable     
    */
    | {
        type: 'unreachable'
    }
    /** Started navigation to the target node, however another navigation request
     *  had been made after this one started, meaning this navigation was cancelled.
    */
    | {
        type: 'cancelled'
    }
    /** An exception was thrown during a transition. */
    | {
        type: 'error',
        message?: string,
        data?: any
    }
    /** Successfully navigated to this node some time in the past, 
     *  however a subsequent navigation request has been made, 
     *  which means this node should not have been accessed     
    */
    | {
        type: 'expired'
    };

export interface GraphAlgorithmInstance<G extends Graph<G>> {
    beginNavigation<CurrentNode extends keyof G['nodes'], TargetNode extends keyof G['nodes']>(navArgs: {
        currentNode: CurrentNode,
        targetNode: TargetNode,
        edges: NavigableEdges<G>
    }): void;

    chooseNextEdge<CurrentNode extends keyof G['nodes'], TargetNode extends keyof G['nodes']>(navArgs: {
        currentNode: CurrentNode,
        targetNode: TargetNode,
        edges: NavigableEdges<G>
    }): Maybe<keyof G['nodes'][CurrentNode]['edges']>;

    postEdgeTransitionAttempt<CurrentNode extends keyof G['nodes'], PrevNode extends keyof G['nodes'], TargetNode extends keyof G['nodes']>(navArgs: {
        currentNode: CurrentNode,
        previousNode: PrevNode,
        targetNode: TargetNode,
        transitionResult: TransitionResult<G>
        edges: NavigableEdges<G>
    }): void;

    endNavigation(result: NavigationResult<G, unknown>): void;
}

export type GraphAlgorithm<G extends Graph<G>> = {
    createInstance(graph: G, initialNode: keyof G['nodes']): GraphAlgorithmInstance<G>
};

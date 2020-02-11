import { Graph } from "./graph-types";

type Parameters = any;
type Digest = any;

export type GraphAlgorithm<G extends Graph<G>, GraphAlgorithmState> = {
    initialParameters: (graph: G) => Parameters,
    // applyDigest: (prevParameters: Parameters, digest: Digest) => Parameters

    beginNavigation: (navArgs: {
        graph: G,
        // graphState: InferGraphState<G>,
        algorithmState: GraphAlgorithmState,
        targetNode: Node,
        targetNodeArg?: any
    }) => GraphAlgorithmState;

    // choseNextEdge: (navArgs: {
    //     graph: UnweightedGraphRepresention,
    //     graphState: GraphState,
    //     algorithmState: GraphAlgorithmState,
    //     targetNode: Node,
    //     targetNodeArg?: any
    // }) => Maybe<Edge>;

    // nextStateAfterEdgeTransitionAttempted: (
    //     navArgs: {
    //         transitionResult: TransitionResult,
    //         graph: UnweightedGraphRepresention,
    //         graphState: GraphState,
    //         algorithmState: GraphAlgorithmState,
    //         targetNode: Node,
    //         targetNodeArg?: any
    //     }) => GraphAlgorithmState;

    // endNavigation: (navArgs: {
    //     navigationResult: NavigationResult, prevState: GraphAlgorithmState,
    //     graph: UnweightedGraphRepresention,
    //     graphState: GraphState,
    //     algorithmState: GraphAlgorithmState,
    //     prevParameters: Parameters
    // }) => [GraphAlgorithmState, Parameters];


};
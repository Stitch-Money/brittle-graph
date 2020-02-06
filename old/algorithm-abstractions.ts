import { Decoder, object } from "decoders";

export type Json = Array<Json> | string | number | boolean | null | Date | { [x: string]: Json };


export type Edge = Flavor<string, 'Edge'>;
export type Node = Flavor<string, 'Node'>;

export type UnweightedGraphRepresention = {
    nodes: {
        [key: string]: {
            edges: {
                [key: string]: { arg?: Decoder<any> }
            }
        }
    }
};

type GraphState = {
    currentNode: Node
};

interface Flavoring<FlavorT> {
    _type?: FlavorT;
}

export type Flavor<T, FlavorT> = T & Flavoring<FlavorT>;

export function assert(condition: any): asserts condition {
    if (!condition) {
        throw new Error(`Expected ${condition} to have a truthy value, but got false`);
    }
}


export function isValidEdge(edge?: { arg?: any }, arg?: any): boolean {
    return edge && (!edge.arg || edge.arg(arg).isOk());
}


export function getReachableEdges(arg: any, graph: UnweightedGraphRepresention, currentNode: Node): Edge[] {
    const node = graph.nodes[currentNode];
    assert(node);
    const edges = node.edges;
    return Object.entries(edges).filter(([k, v]) => isValidEdge(v, arg)).map(([k]) => k);
}


export type Maybe<T> = T | null;

export type UnsignedFloat = number & { __unsigned__: void };

export type TransitionResult =
    { type: 'transition_succeeded', cost: UnsignedFloat, from: Node, to: Node, arg?: any }
    | { type: 'transition_failed', reason: 'error', cost: UnsignedFloat, from: Node, to: Node, arg?: any, retry?: boolean }
    | { type: 'transition_failed', reason: 'graph_faulted', from: Node, to: Node, arg?: any }
    | { type: 'transition_failed', reason: 'unreachable' }
    | { type: 'transition_failed', reason: 'unexpected_transition', from: Node, desiredNode: Node, resultantNode: Node, cost: UnsignedFloat };

export type NavigationResult =
    | { type: 'navigation_succeeded', totalCost: UnsignedFloat }
    | { type: 'navigation_failed' };

type ExtractDecoderType<T> = T extends Decoder<infer Arg> ? Arg : never;


export type GraphAlgorithm<GraphAlgorithmState, Parameters, ParameterDigest = Parameters> =
    {
        initialParameters: (graph: UnweightedGraphRepresention) => Parameters,
        applyDigest: (prevParameters: Parameters, digest: ParameterDigest) => Parameters

        serializeDigest: (p: ParameterDigest) => Json,
        deserializeDigest: (json: Json) => ParameterDigest,

        initialGraphAlgorithmState: (initializeArgs: {
            graph: UnweightedGraphRepresention,
            parameters: Parameters,
            initialGraphState: GraphState
        }) => GraphAlgorithmState,

        beginNavigation: (navArgs: {
            graph: UnweightedGraphRepresention,
            graphState: GraphState,
            algorithmState: GraphAlgorithmState,
            targetNode: Node,
            targetNodeArg?: any
        }) => GraphAlgorithmState;

        choseNextEdge: (navArgs: {
            graph: UnweightedGraphRepresention,
            graphState: GraphState,
            algorithmState: GraphAlgorithmState,
            targetNode: Node,
            targetNodeArg?: any
        }) => Maybe<Edge>;

        nextStateAfterEdgeTransitionAttempted: (
            navArgs: {
                transitionResult: TransitionResult,
                graph: UnweightedGraphRepresention,
                graphState: GraphState,
                algorithmState: GraphAlgorithmState,
                targetNode: Node,
                targetNodeArg?: any
            }) => GraphAlgorithmState;

        endNavigation: (navArgs: {
            navigationResult: NavigationResult, prevState: GraphAlgorithmState,
            graph: UnweightedGraphRepresention,
            graphState: GraphState,
            algorithmState: GraphAlgorithmState,
            prevParameters: Parameters
        }) => [GraphAlgorithmState, Parameters];

        receiveNewParameters: (args: { prevParameters: Parameters, newParameters: Parameters, graphState: GraphState, prevAlgorithmState: GraphAlgorithmState }) => Parameters
    };

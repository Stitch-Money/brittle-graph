import { Decoder } from 'decoders';

export type TransitionResult = { type: 'succeeded' };

export type MutationResult =
    { type: 'transition' }
    | { type: 'update_context' };


export type Maybe<T> = T | null;

export type Edge<GraphState, ThisGraph extends Graph<GraphState, ThisGraph>, NodeName extends keyof ThisGraph['nodes']> =
    ThisGraph['nodes'][NodeName] extends NodeTemplate<any, GraphState, ThisGraph, NodeName>
    ? (arg: InferTemplatedNodeArg<ThisGraph['nodes'][NodeName]>) => any
    : () => any;


export type FieldContext = any;
export type MutationContext = any;


export type Node<GraphState, ThisGraph extends Graph<GraphState, ThisGraph>> = {
    onEnter?: () => {},
    onExit?: () => {},
    assertions?: () => any[],
    fields?: {
        [fieldName: string]: (ctx: FieldContext, fieldArg: any) => any
    },
    mutations?: {
        [key: string]: (ctx: MutationContext, mutationArg: any) => MutationResult
    },
    edges?: {
        [NodeName in keyof ThisGraph['nodes']]?: Edge<GraphState, ThisGraph, NodeName>
    }
};


type InferTemplatedNodeArg<T extends NodeTemplate<any, any, any, any>> = T extends NodeTemplate<infer Arg, any, any, any> ? Arg : never;


type AdjacentTemplatedNodeArgMapping<
    NodeArg,
    GraphState,
    ThisGraph extends Graph<GraphState, ThisGraph>,
    TargetNodeName extends keyof ThisGraph['nodes']
    > =
    {
        [NodeName in keyof ThisGraph['nodes']]:
        // First select only templated nodes, as they're candidates for mapping
        ThisGraph['nodes'][NodeName] extends NodeTemplate<any, GraphState, ThisGraph, NodeName>
        // Then select only the adjacent nodes
        ? (
            (keyof (ThisGraph['nodes'][NodeName]['edges'])) extends TargetNodeName
            ? (arg: NodeArg) => Maybe<InferTemplatedNodeArg<ThisGraph['nodes'][NodeName]>>
            : never
        )
        : never
    };




export type NodeTemplate<
    NodeArg,
    GraphState,
    ThisGraph extends Graph<GraphState, ThisGraph>,
    NodeName extends keyof ThisGraph['nodes']
    > = {
        argDecoder: Decoder<NodeArg>,
        mapAdjacentTemplatedNodeArgs: AdjacentTemplatedNodeArgMapping<NodeArg, GraphState, ThisGraph, NodeName>
    } & Node<GraphState, ThisGraph>;


export type Graph<GraphState, Self extends Graph<GraphState, Self>> = {
    nodes: {
        INITIAL: Node<GraphState, Self> | NodeTemplate<any, GraphState, Self, 'INITIAL'>,
    } & { [NodeName in keyof Self['nodes']]: Node<GraphState, Self> | NodeTemplate<any, GraphState, Self, NodeName> }
};



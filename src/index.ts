import { Decoder, object, string } from 'decoders';
import { bfs } from './algorithms/bfs';
import { GraphAlgorithm, UnweightedGraphRepresention, Node as NodeName, Edge as EdgeName } from './abstractions';

/* If you have multiple possible candidates for an inferred type, the compiler
* can return either a union or an intersection depending on how those 
*candidates are used. 
*
* ((() => A) | (() => B)) extends (() => infer T) ?T: never 
* will produce A | B because function types are covariant in their return type.
* But((x: A) => void) | ((y: B) => void) 
*    extends ((z: infer T) => void) ? T : never 
* will produce A & B because function types are contravariant in their argument
* types
*/
// type UnionToIntersection<U> =
//     (U extends any ? (k: U) => void : never) extends
//     ((k: infer I) => void) ? I : never

type TransitionResult = 'transitioned';
type PromiseOrResult<T> = Promise<T> | T;

type NodeState<Context, Node extends GraphNode<Context, any, Node>> =
    Node extends { arg: Decoder<infer Arg> }
    ? { ctx: Context, nodeArg: Arg }
    : { ctx: Context };

type FieldDefinition<Context, Node extends GraphNode<Context, any, Node>> =
    (
        nodeState: NodeState<Context, Node>,
        fieldArg: any
    ) => any;

type MutationDefinition<Context, Node extends GraphNode<Context, any, Node>> =
    (
        nodeState: NodeState<Context, Node>,
        fieldArg: any
    ) => any;


type GraphEdge<Context, Nodes extends GraphNodes<Context, Nodes>, Node extends keyof Nodes> =
    (Nodes[Node]['arg']) extends Decoder<infer Arg>
    ? ((arg: Arg, ctx: Context) => PromiseOrResult<TransitionResult>)
    : ((ctx: Context) => PromiseOrResult<TransitionResult>);

type GraphNode<Context, Nodes extends GraphNodes<Context, Nodes>, Node extends GraphNode<Context, Nodes, Node>> = {
    /** Decoder describing the required arguments to enter this node. 
     * Edges that directly transition to this node may accept an argument of this   
     * type. 
     * 
     * Important Note: The engine will check the argument provided against the decoders of
     * OTHER nodes. If a given decoder accepts the value, the graph engine will consider the
     * edeges leading to the node as candidates.     
     */
    arg?: Decoder<any>,
    /** Asserts are optional functions which are called as sanity checks to confirm 
     * that the graph engine actually is in the state it thinks it is in.
     * 
     * Examples of when asserts are called, are directly after a transition
     *  and mutation.
     */
    asserts?: ((arg: { ctx: Context, nodeState: NodeState<Context, Node> }) => void)[],
    fields?: {
        [key: string]: FieldDefinition<Context, Node>
    },
    mutations?: {
        [key: string]: MutationDefinition<Context, Node>
    },
    edges?: {
        [Node in keyof Nodes]?: GraphEdge<Context, Nodes, Node>
    }
};

export type EdgeWeights<Nodes extends GraphNodes<any, Nodes>> = {
    [From in keyof Nodes]: {
        [To in keyof ((Nodes[From])['edges'])]: number
    }
};

export type GraphNodes<Context, Self extends GraphNodes<Context, Self>> =
    { [key: string]: GraphNode<Context, Self, GraphNode<Context, Self, any>> }
    & {
        INITIAL: {
            arg?: Decoder<any>,
            onEnter: Self['INITIAL']['arg'] extends Decoder<infer Arg> ? (arg: Arg) => Context : () => Context
            edges: {}
        }
    };


type BuiltField<Context, Nodes extends GraphNodes<Context, Nodes>, Node extends GraphNode<Context, Nodes, Node>, Field extends Node['fields']> =
    Field extends (() => infer Result)
    ? () => Result
    : (
        Field extends ((nodeState: any) => infer Result)
        ? () => Result
        : (Field extends ((nodeState: any, fieldArg: infer Arg) => infer Result)
            ? (arg: Arg) => Result
            : never
        )
    );

type BuiltMutation<Context, Nodes extends GraphNodes<Context, Nodes>, Node extends GraphNode<Context, Nodes, Node>, Mutation extends Node['mutations']> =
    Mutation extends (() => infer Result)
    ? () => Result
    : (
        Mutation extends ((nodeState: any) => infer Result)
        ? () => Result
        : (Mutation extends ((nodeState: any, fieldArg: infer Arg) => infer Result)
            ? (arg: Arg) => Result
            : never
        )
    );


type SuccessfulTransition<Context, Nodes extends GraphNodes<Context, Nodes>, NodeName extends keyof Nodes> = {
    name: NodeName,
    transitionResult: 'successful',
}
    & (
        Nodes[NodeName] extends { fields: any }
        ? { fields: { [FieldName in keyof Nodes[NodeName]['fields']]: BuiltField<Context, Nodes, Nodes[NodeName], Nodes[NodeName]['fields'][FieldName]> } }
        : {}
    )
    & (
        Nodes[NodeName] extends { mutations: any }
        ? { mutations: { [MutationName in keyof Nodes[NodeName]['mutations']]: BuiltMutation<Context, Nodes, Nodes[NodeName], Nodes[NodeName]['mutations'][MutationName]> } }
        : {}
    );

type BuiltGraphTransitionResult<Context, Nodes extends GraphNodes<Context, Nodes>, NodeName extends keyof Nodes> =
    SuccessfulTransition<Context, Nodes, NodeName>;

type GoToNode<Context, Nodes extends GraphNodes<Context, Nodes>, Node extends keyof Nodes> =
    Nodes[Node] extends { arg: Decoder<infer NodeArg> }
    ? (arg: NodeArg) => Promise<BuiltGraphTransitionResult<Context, Nodes, Node>>
    : () => Promise<BuiltGraphTransitionResult<Context, Nodes, Node>>


type ProcessedGraphDefinition<Context, Nodes extends GraphNodes<Context, Nodes>> =
    { currentNode: { name: keyof Node } } &
    {
        [Node in keyof Nodes]: GoToNode<Context, Nodes, Node>
    };

type GraphInstance<Context, Nodes extends GraphNodes<Context, Nodes>> =
    { currentNode: { name: keyof Node } } &
    {
        [Node in keyof Nodes]: GoToNode<Context, Nodes, Node>
    };



type GraphDefinition<Context, Nodes extends GraphNodes<Context, Nodes>, Algorithm extends GraphAlgorithm<any, any, any, any>> = {
    nodes: Nodes,
    initializer: (args: any) => [Context],
    algorithm: Algorithm
};




export function process<Context, Nodes extends GraphNodes<Context, Nodes>, Algorithm extends GraphAlgorithm<any, any, any, any>>(args: GraphDefinition<Context, Nodes, Algorithm>): ProcessedGraphDefinition<Context, Nodes> {
    function getUnweightGraphRepresentation(): UnweightedGraphRepresention {
        const nodes = args.nodes;
        const result = {} as UnweightedGraphRepresention;
        for (let nodeName in nodes) {
            const node = nodes[nodeName];
            const edges: { edges: { [key: string]: { arg?: any } } } = { edges: {} };
            // result[nodeName as NodeName] = { edges: {} };
            for (let edge in node.edges) {
                edges.edges[edge as string] = { arg: nodes[edge].arg };
            }
            result.nodes[nodeName] = edges;
        }
        return result;
    }
    const algorithm = args.algorithm;
    const unweightedGraph = getUnweightGraphRepresentation();

    const parameters = algorithm.initialParameters(unweightedGraph, {});

    return {} as ProcessedGraphDefinition<Context, Nodes>;
}

export function instantiate<GraphDefinition extends ProcessedGraphDefinition<any, any>>(args: {
    processedGraph: GraphDefinition
}) {

}

const processedGraph = process({
    nodes: {
        INITIAL: {
            onEnter: () => ({}),
            edges: {

            }
        },
        FROG: {
            asserts: [() => { }],
            arg: object({
                name: string
            }),
            fields: {
                legs: (_state, arg: { includeToes: boolean }) => 4
            }
        },
        CATS: {
            fields: {
                claws: () => 10,
                legs: (state, arg: { includeToes: boolean, includeBacklegs: boolean }) => arg.includeBacklegs ? 4 : 2
            },
            mutations: {
                jump: (ctx, height: number) => 'ok'
            },
            edges: {
                FROG: (args: { name: string }, ctx: unknown) => args.name === 'benny' ? 'transitioned' : 'transitioned',
            }
        }
    },
    initializer: () => [({})],
    algorithm: bfs
});



async function testFunction() {
    const eskimo = await processedGraph.CATS();
    eskimo.fields.claws()

}

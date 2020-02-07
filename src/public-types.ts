export type TransitionResult<ThisGraph extends Graph<ThisGraph>> = { type: 'transitioned' };

export type MutationResult<ThisGraph extends Graph<ThisGraph>> =
    { type: 'transition' }
    | { type: 'update_context' };

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
type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends
    ((k: infer I) => void) ? I : never

export type Maybe<T> = T | null;

export type Edge<ThisGraph extends Graph<ThisGraph>> =
    (ctx: EdgeContext, arg: any) => TransitionResult<ThisGraph>


export type FieldContext = any;
export type MutationContext = any;

type NodeEdges<
    ThisGraph extends Graph<ThisGraph>,
    Node extends { edges?: any }
    > =
    (keyof Node['edges']) extends keyof (ThisGraph["nodes"])
    ? { [NodeName in keyof ThisGraph['nodes']]?: Edge<ThisGraph> }
    : (("Edges connecting to inexistent nodes detected: " | Exclude<keyof (Node['edges']), keyof (ThisGraph['nodes'])>));


type Node<ThisGraph extends Graph<ThisGraph>, Self extends { edges?: any, mapAdjacentTemplatedNodeArgs?: any }, Name extends keyof ThisGraph['nodes']> = {
    onEnter?: () => {},
    onExit?: () => {},
    assertions?: () => any[],
    fields?: {
        [fieldName: string]: (ctx: FieldContext, fieldArg: any) => any
    },
    mutations?: {
        [key: string]: (ctx: MutationContext, mutationArg: any) => MutationResult<ThisGraph>
    },
    edges?: NodeEdges<ThisGraph, Self>
    mapAdjacentTemplatedNodeArgs?: AdjacentTemplatedNodeArgMapping<ThisGraph, Name, Self>
};

type EdgeContext = any;

type GetAdjacentNodeNames<ThisGraph extends Graph<ThisGraph>, TargetNodeName extends keyof ThisGraph['nodes']> = {
    [NodeName in keyof ThisGraph['nodes']]: ThisGraph['nodes'][NodeName] extends { edges: { [K in TargetNodeName]: any } } ? NodeName : never
}[keyof ThisGraph['nodes']];

type GetAdjacentTemplatedNodeNames<ThisGraph extends Graph<ThisGraph>, TargetNodeName extends keyof ThisGraph['nodes']> =
    {
        [K in GetAdjacentNodeNames<ThisGraph, TargetNodeName>]: (GetNodeArgs<ThisGraph, K> extends never ? never : K)
    }[GetAdjacentNodeNames<ThisGraph, TargetNodeName>];



type AdjacentTemplatedNodeArgMapping<
    ThisGraph extends Graph<ThisGraph>,
    TargetNodeName extends keyof ThisGraph['nodes'],
    Node extends { mapAdjacentTemplatedNodeArgs?: any }
    > =
    keyof Node['mapAdjacentTemplatedNodeArgs'] extends GetAdjacentTemplatedNodeNames<ThisGraph, TargetNodeName>
    ? ({
        [NodeName in GetAdjacentTemplatedNodeNames<ThisGraph, TargetNodeName>]:
        (arg: GetNodeArgs<ThisGraph, TargetNodeName>) => GetNodeArgs<ThisGraph, NodeName> })
    : (("Non adjacent, templated nodes detected: " | Exclude<keyof (Node['mapAdjacentTemplatedNodeArgs']), (GetAdjacentTemplatedNodeNames<ThisGraph, TargetNodeName>)>));


type InferEdgeArgFromFunction<T extends () => any> =
    T extends () => unknown
    ? never
    : (T extends (ctx: unknown) => any
        ? never
        : (
            T extends (ctx: unknown, arg: infer Arg) => any
            ? Arg :
            never
        )
    );

type GetNodeArg<ThisGraph extends Graph<ThisGraph>, AdjacentNodeName extends keyof ThisGraph['nodes'], TargetNodeName extends keyof ThisGraph['nodes']> =
    ThisGraph['nodes'][AdjacentNodeName]['edges'] extends { [K in TargetNodeName]: any }
    ? (InferEdgeArgFromFunction<ThisGraph['nodes'][AdjacentNodeName]['edges'][TargetNodeName]>)
    : never;



export type GetNodeArgs<ThisGraph extends Graph<ThisGraph>, TargetNodeName extends keyof ThisGraph['nodes']> =
    UnionToIntersection<
        {
            [AdjacentNodeName in GetAdjacentNodeNames<ThisGraph, TargetNodeName>]: GetNodeArg<ThisGraph, AdjacentNodeName, TargetNodeName>
        }[GetAdjacentNodeNames<ThisGraph, TargetNodeName>]
    >;


export type Graph<Self extends Graph<Self>> = {
    nodes: { [NodeName in keyof Self['nodes']]: Node<Self, Self['nodes'][NodeName], NodeName> }
};



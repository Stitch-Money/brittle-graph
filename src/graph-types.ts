export type TransitionResult<ThisGraph extends Graph<ThisGraph>> =
    { type: 'transitioned', cost: number, nextState?: InferGraphState<ThisGraph> }
    | { type: 'unexpectedly_transitioned', to: keyof ThisGraph['nodes'], cost?: number, nextState?: InferGraphState<ThisGraph> }
    /** 
     * If canRetry is true, it indicates that the transition may be attempted again, 
     * however if false, the graph algorithm will to find another route to the target.
     */
    | { type: 'transition_failed', canRetryEdge: boolean, message?: string, data?: any, nextState?: InferGraphState<ThisGraph> }
    /**
     * Indicates that this instance of the graph has entered a state that it cannot recover from.
     * The only solution is to terminate this instance of the graph, and possibly try again later
     */
    | { type: 'graph_faulted', message?: string, data?: any, nextState?: InferGraphState<ThisGraph> };

export type Mutation<ThisGraph extends Graph<ThisGraph>> =
    { type: 'transitioned', to: keyof ThisGraph['nodes'] }
    | { type: 'update_state', newState: InferGraphState<ThisGraph> }
    | { type: 'graph_faulted', message?: string, data?: any }
    ;

export type MutationResult<ThisGraph extends Graph<ThisGraph>> =
    { result?: any, effects?: Array<Mutation<ThisGraph>> };

/* If you have multiple possible candidates for an inferred type, the compiler
* can return either a union or an intersection depending on how those 
*candidates are used. 
*
* ((() => A) | (() => B)) extends (() => infer T) ?T: never 
* will produce A | B because function types are covariant in their return type.
* But((x: A) => void) | ((y: B) => void) 
*    extends ((z: infer T) => void) ? T : never 
* will produce A & B because function types are contravariant in their argument
* types.
* 
* The use of the wrapper `[U] extends [never]` is necessary to allow the next 
* clause to actually evaluate, as `U extends never` would force premature inference
*/
type UnionToIntersection<U> =
    ([U] extends [never] ? never :
        (U extends any
            ? ((k: U) => void)
            : never
        ) extends ((k: infer I) => void) ? I : never);

export type Maybe<T> = T | null;

export type Edge<ThisGraph extends Graph<ThisGraph>> =
    (ctx: EdgeContext<ThisGraph>, arg: any) => TransitionResult<ThisGraph> | Promise<TransitionResult<ThisGraph>>;

type InferGraphState<G extends Graph<any>> =
    G['initializer'] extends (arg: any) => Promise<{ currentState: infer State }>
    ? State
    : never;

export type EdgeContext<G extends Graph<G>> = { currentState: InferGraphState<G> };
export type FieldContext<G extends Graph<G>> = { currentState: InferGraphState<G> };
export type MutationContext<G extends Graph<G>> = { currentState: InferGraphState<G> };
export type AssertionContext<G extends Graph<G>> = { currentState: InferGraphState<G> };

type NodeEdges<
    ThisGraph extends Graph<ThisGraph>,
    Node extends { edges?: any }
    > =
    (keyof Node['edges']) extends keyof (ThisGraph["nodes"])
    ? { [NodeName in keyof ThisGraph['nodes']]?: Edge<ThisGraph> }
    : (("Edges connecting to inexistent nodes detected: " | Exclude<keyof (Node['edges']), keyof (ThisGraph['nodes'])>));

type Node<ThisGraph extends Graph<ThisGraph>, Self extends { edges?: any, mapAdjacentTemplatedNodeArgs?: any }, Name extends keyof ThisGraph['nodes']> = {
    onEnter?: (ctx: MutationContext<ThisGraph>) => Promise<Array<Mutation<ThisGraph>>>,
    onExit?: (ctx: MutationContext<ThisGraph>) => Promise<Array<Mutation<ThisGraph> & { type: Omit<Mutation<ThisGraph>['type'], 'transitioned'> }>>,
    assertions?: ((ctx: AssertionContext<ThisGraph>) => (any | Promise<any>))[],
    fields?: {
        [fieldName: string]: (ctx: FieldContext<ThisGraph>, fieldArg: any) => any
    },
    mutations?: {
        [key: string]: (ctx: MutationContext<ThisGraph>, mutationArg: any) => Promise<MutationResult<ThisGraph>>
    },
    edges?: NodeEdges<ThisGraph, Self>
} & (GetNodeArgs<ThisGraph, Name> extends never ? {} : { mapAdjacentTemplatedNodeArgs: AdjacentTemplatedNodeArgMapping<ThisGraph, Name, Self> });

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
    Node extends { mapAdjacentTemplatedNodeArgs?: any | never }
    > =
    ((keyof (Node['mapAdjacentTemplatedNodeArgs'])) extends GetAdjacentTemplatedNodeNames<ThisGraph, TargetNodeName>
        ? ({
            [NodeName in GetAdjacentTemplatedNodeNames<ThisGraph, TargetNodeName>]:
            (arg: GetNodeArgs<ThisGraph, TargetNodeName>) => GetNodeArgs<ThisGraph, NodeName>
        })
        : (("Non adjacent, templated nodes detected: " | Exclude<keyof (Node['mapAdjacentTemplatedNodeArgs']), (GetAdjacentTemplatedNodeNames<ThisGraph, TargetNodeName>)>))
    );


/**
 *  NB, order is important here, () => uknown is the most restrictive check,
 *  while (ctx: uknown, arg: infer Arg) => any is the least, which means it matches
 *  both (ctx) => any and () => any
 */
type InferEdgeArgFromFunction<T extends (ctx: any, arg: any) => any> =
    (T extends (ctx: any) => any
        ? never
        : (
            T extends (ctx: any, arg: infer Arg) => any
            ? Arg
            : never
        )
    );

type GetNodeArg<ThisGraph extends Graph<ThisGraph>, AdjacentNodeName extends keyof ThisGraph['nodes'], TargetNodeName extends keyof ThisGraph['nodes']> =
    ThisGraph['nodes'][AdjacentNodeName]['edges'] extends { [K in TargetNodeName]: (ctx: any, arg: any) => any }
    ? (InferEdgeArgFromFunction<ThisGraph['nodes'][AdjacentNodeName]['edges'][TargetNodeName]>)
    : never;

export type GetNodeArgs<ThisGraph extends Graph<ThisGraph>, TargetNodeName extends keyof ThisGraph['nodes']> =
    UnionToIntersection<
        {
            [AdjacentNodeName in GetAdjacentNodeNames<ThisGraph, TargetNodeName>]: GetNodeArg<ThisGraph, AdjacentNodeName, TargetNodeName>
        }[GetAdjacentNodeNames<ThisGraph, TargetNodeName>]
    >;

export type Graph<Self extends Graph<Self>> = {
    nodes: { [NodeName in keyof Self['nodes']]: Node<Self, Self['nodes'][NodeName], NodeName> },
    initializer: (arg: any) => Promise<{ currentNode: keyof (Self['nodes']), currentState: any }>
};

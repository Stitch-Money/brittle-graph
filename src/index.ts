import { Graph, MutationResult, GetNodeArgs } from "./graph-types";
import { GraphAlgorithm } from "./algorithm-types";
export { Graph } from "./graph-types";


export function graph<G extends Graph<G>>(graph: G): G {
    return graph;
}


type InferInitializationArg<G extends Graph<G>> =
    G['initializer'] extends (arg: infer Arg) => any
    ? Arg
    : never;

type InferCompiledField<T extends (ctx: any, fieldArg: any) => any> =
    T extends (ctx: any) => infer ReturnType
    ? (() => ReturnType)
    : (
        T extends ((ctx: any, fieldArg: infer FieldArg) => infer ReturnType)
        ? ((fieldArg: FieldArg) => ReturnType)
        : never
    );


type InferMutationResult<T extends (ctx: any, mutationArg: any) => Promise<MutationResult<any>>> =
    T extends ((ctx: any, fieldArg: any) => Promise<{ result: infer Result }>)
    ? Result
    : void;

type InferCompiledMutation<T extends (ctx: any, mutationArg: any) => Promise<MutationResult<any>>> =
    T extends (ctx: any) => any
    ? (() => Promise<InferMutationResult<T>>)
    : (
        T extends ((ctx: any, fieldArg: infer FieldArg) => any)
        ? ((fieldArg: FieldArg) => Promise<InferMutationResult<T>>)
        : never
    );

type InferCompileNodeFunction<G extends Graph<G>, NodeName extends keyof G['nodes']> =
    GetNodeArgs<G, NodeName> extends never
    ? () => Promise<{
        fields: {
            [FieldName in keyof G['nodes'][NodeName]['fields']]:
            InferCompiledField<G['nodes'][NodeName]['fields'][FieldName]>
        },
        mutations: {
            [FieldName in keyof G['nodes'][NodeName]['mutations']]: InferCompiledMutation<G['nodes'][NodeName]['mutations'][FieldName]>
        }
    }>
    : (arg: GetNodeArgs<G, NodeName>) => Promise<{
        fields: {
            [FieldName in keyof G['nodes'][NodeName]['fields']]:
            InferCompiledField<G['nodes'][NodeName]['fields'][FieldName]>
        },
        mutations: {
            [FieldName in keyof G['nodes'][NodeName]['mutations']]: InferCompiledMutation<G['nodes'][NodeName]['mutations'][FieldName]>
        }
    }>;


export type CompiledGraphInstance<G extends Graph<G>> = {
    [NodeName in keyof G['nodes']]: InferCompileNodeFunction<G, NodeName>
} & {
    currentNode: keyof (G['nodes']),
    id: GraphInstanceIdentifier
}

export type GraphInstanceIdentifier = string & { __graphInstance__: void };

export interface CompiledGraph<G extends Graph<G>, A extends GraphAlgorithm<G>> {
    createInstance:
    InferInitializationArg<G> extends never
    ? () => Promise<CompiledGraphInstance<G>> : (arg: InferInitializationArg<G>) => Promise<CompiledGraphInstance<G>>;

}

class CompiledGraphImpl<G extends Graph<G>, A extends GraphAlgorithm<G>> implements CompiledGraph<G, A> {
    createInstance: InferInitializationArg<G> extends never ? () => Promise<CompiledGraphInstance<G>> : (arg: InferInitializationArg<G>) => Promise<CompiledGraphInstance<G>>;

    constructor(graph: G, algorithm: A) {
        this.createInstance = ((arg?: InferInitializationArg<G>) => {
            if (arg) {

            } else {

            }
        }) as CompiledGraph<G, A>['createInstance'];
    }

}

export function compileGraph<G extends Graph<G>, A extends GraphAlgorithm<G>>(graph: G, algorithm: A): CompiledGraph<G, A> {
    return new CompiledGraphImpl(graph, algorithm);
}

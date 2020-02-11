import { Graph, MutationResult, GetNodeArgs } from "./graph-types";
import { GraphAlgorithm, GraphAlgorithmInstance } from "./algorithm-types";
export { Graph } from "./graph-types";


export function graph<G extends Graph<G>>(graph: G): G & { __typechecked__: void } {
    return graph as G & { __typechecked__: void };
}

type InferInitializer<G extends Graph<G>, A extends GraphAlgorithm<G>> =
    G['initializer'] extends () => any
    ? () => Promise<CompiledGraphInstance<G>>
    : (G['initializer'] extends (arg: infer Arg) => any ? (arg: Arg) => Promise<CompiledGraphInstance<G>> : never);

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


type CompiledGraphInstanceProps<G extends Graph<G>> = {
    currentNode: keyof (G['nodes']),
    id: GraphInstanceIdentifier
};

export type CompiledGraphInstance<G extends Graph<G>> = {
    [NodeName in keyof G['nodes']]: InferCompileNodeFunction<G, NodeName>
} & CompiledGraphInstanceProps<G>;

export type GraphInstanceIdentifier = string & { __graphInstance__: void };

export interface CompiledGraph<G extends Graph<G>, A extends GraphAlgorithm<G>> {
    createInstance: InferInitializer<G, A>;
}


class CompiledGraphInstanceImpl<G extends Graph<G>, A extends GraphAlgorithm<G>> implements CompiledGraphInstanceProps<G> {
    currentNode: keyof (G['nodes']);
    id: GraphInstanceIdentifier;
    state: any;
    algorithmInstance: GraphAlgorithmInstance<G>;

    constructor(graph: G, currentNode: keyof G['nodes'], initialState: any, id: GraphInstanceIdentifier, alg: GraphAlgorithmInstance<G>) {
        this.currentNode = currentNode;
        this.state = initialState;
        this.id = id;
        this.algorithmInstance = alg;
    }


    async goto(targetNode: keyof G['nodes'], arg: any) {
        return new Promise((resolve, reject) => {
            // begin navigation
            (this.algorithmInstance.beginNavigation as ((arg: any) => void))({ currentNode: this.currentNode, targetNode, targetNodeArg: arg });
            let isNavigating = false;
            while (isNavigating) {

            }
            resolve();
        });
    }
}

function assert(x: any): asserts x {
    if (!x) {
        throw new Error('Expected value to be truthy. Internal error');
    }
}

function guidGenerator(): GraphInstanceIdentifier {
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4()) as GraphInstanceIdentifier;
}

class CompiledGraphImpl<G extends Graph<G>, A extends GraphAlgorithm<G>> implements CompiledGraph<G, A> {
    createInstance: InferInitializer<G, A>;

    constructor(graph: G, algorithm: A) {
        const nodeNames: (keyof G['nodes'])[] = Object.keys(graph.nodes) as (keyof G['nodes'])[];
        const proxyHandler = {
            get: function (target: CompiledGraphInstanceImpl<G, A>, prop: keyof G['nodes']) {
                assert(nodeNames.includes(prop));
                return (args: any) => target.goto(prop, args);
            }
        };

        this.createInstance = (async (args) => {
            const intialStateAndNode = await graph.initializer(args);
            return new Proxy(
                new CompiledGraphInstanceImpl(graph, intialStateAndNode.currentNode, intialStateAndNode.currentState, guidGenerator(), algorithm.createInstance(graph, intialStateAndNode.currentNode)),
                proxyHandler
            ) as any as CompiledGraphInstance<G>;
        }) as InferInitializer<G, A>;
    }

}

export function compileGraph<G extends Graph<G>, A extends GraphAlgorithm<G>>(graph: G & { __typechecked__: void }, algorithm: A): CompiledGraph<G, A> {
    return new CompiledGraphImpl(graph as G, algorithm);
}

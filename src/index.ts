import { Graph, MutationResult, GetNodeArgs } from "./graph-types";
import { GraphAlgorithm, GraphAlgorithmInstance } from "./algorithm-types";
import Queue from 'denque';

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

export type NavigationResult<G extends Graph<G>, NodeName extends keyof G['nodes']> =
    | {
        type: 'successful',
        fields: {
            [FieldName in keyof G['nodes'][NodeName]['fields']]:
            InferCompiledField<G['nodes'][NodeName]['fields'][FieldName]>
        },
        mutations: {
            [FieldName in keyof G['nodes'][NodeName]['mutations']]: InferCompiledMutation<G['nodes'][NodeName]['mutations'][FieldName]>
        }
    }
    | {
        type: 'unreachable'
    } | {
        type: 'cancelled'
    };

type InferCompileNodeFunction<G extends Graph<G>, NodeName extends keyof G['nodes']> =
    GetNodeArgs<G, NodeName> extends never
    ? () => Promise<NavigationResult<G, NodeName>>
    : (arg: GetNodeArgs<G, NodeName>) => Promise<NavigationResult<G, NodeName>>;


type CompiledGraphInstanceProps<G extends Graph<G>> = {
    currentNode: { [NodeName in keyof (G['nodes'])]: {
        name: NodeName,
        fields: {
            [FieldName in keyof G['nodes'][NodeName]['fields']]:
            InferCompiledField<G['nodes'][NodeName]['fields'][FieldName]>
        },
        mutations: {
            [FieldName in keyof G['nodes'][NodeName]['mutations']]: InferCompiledMutation<G['nodes'][NodeName]['mutations'][FieldName]>
        }
    } }[keyof (G['nodes'])],
    id: GraphInstanceIdentifier,
};

export type CompiledGraphInstance<G extends Graph<G>> = {
    [NodeName in keyof G['nodes']]: InferCompileNodeFunction<G, NodeName>
} & CompiledGraphInstanceProps<G>;

export type GraphInstanceIdentifier = string & { __graphInstance__: void };

export interface CompiledGraph<G extends Graph<G>, A extends GraphAlgorithm<G>> {
    createInstance: InferInitializer<G, A>;
}

type NavigableEdge = { navigable: boolean, arg?: any };
type NavigableEdges<G extends Graph<G>> = {
    [N in keyof G['nodes']]: { [E in keyof G['nodes'][N]['edges']]: NavigableEdge }
};

class CompiledGraphInstanceImpl<G extends Graph<G>, A extends GraphAlgorithm<G>> implements CompiledGraphInstanceProps<G> {
    currentNodeName: keyof G['nodes'];

    id: GraphInstanceIdentifier;
    state: any;
    algorithmInstance: GraphAlgorithmInstance<G>;
    graph: G;
    episode: number;
    fieldProxyHandler = {
        get: (target: { [key: string]: (ctx: any, arg: any) => any }, prop: keyof G['nodes'][any]['fields']) => {

        }
    };

    mutationProxyHandler = {
        get: (target: { [key: string]: (ctx: any, arg: any) => any }, prop: keyof G['nodes'][any]['fields']) => {
            const nodeName = this.currentNode.name;
            return (args: any) => target.goto(prop, args);
        }
    };


    constructor(graph: G, currentNode: keyof G['nodes'], initialState: any, id: GraphInstanceIdentifier, alg: GraphAlgorithmInstance<G>) {
        this.currentNodeName = currentNode;
        this.graph = graph;
        this.state = initialState;
        this.id = id;
        this.algorithmInstance = alg;
        this.episode = 0;

        // This function initializes the edge navigabilitity by checking the arity of the edge functions
    }

    private createNodeProxy(nodeName: keyof G['nodes']): CompiledGraphInstanceProps<G>['currentNode'] {
        return new Proxy({ name: nodeName }, {}) as CompiledGraphInstanceProps<G>['currentNode'];
        // const currentNode = this.graph.nodes[nodeName];
        // return {
        //     name: this.currentNodeName,
        //     fields: (currentNode.fields ? new Proxy(currentNode.fields, this.fieldProxyHandler) : {}) as CompiledGraphInstanceProps<G>['currentNode']['fields'],
        //     mutations: (currentNode.mutations ? new Proxy(currentNode.mutations, this.mutationProxyHandler) : {}) as CompiledGraphInstanceProps<G>['currentNode']['mutations']
        // };
    }

    get currentNode(): CompiledGraphInstanceProps<G>['currentNode'] {
        return this.createNodeProxy(this.currentNodeName);
    }

    getNavigableEdges(targetNodeName: keyof G['nodes'], arg: any) {
        const edges = {} as NavigableEdges<G>;
        const target = this.graph.nodes[targetNodeName];

        // Iterative over nodes to find edges that don't require arguments
        for (const nodeName in this.graph.nodes) {
            const node = this.graph.nodes[nodeName];
            const edgeNavigabilitity: { [key: string]: { navigable: boolean } } = {};
            for (const edgeName in node.edges) {
                const edgeF = node.edges[edgeName] as () => any;
                edgeNavigabilitity[edgeName] = { navigable: edgeF.length <= 1 };
            }
            (edges[nodeName] as { [key: string]: { navigable: boolean } }) = edgeNavigabilitity;
        }

        // Find directly adjacent edges. These don't require a back mapping, so will always work assuming type system
        // enforces input of given arg
        for (const nodeName in this.graph.nodes) {
            const node = this.graph.nodes[nodeName];
            if (node.edges && (node.edges as { [_ in keyof G['nodes']]: any })[targetNodeName]) {
                (edges[nodeName])[targetNodeName as keyof G['nodes'][any]['edges']] = { navigable: true, arg };
            }
        }

        // BEGIN BFS
        // -----------------
        // Start from target node working backwards to map arg to all navigable 
        // edges. 
        const queue = new Queue<{ arg: any, name: keyof G['nodes'], node: { mapAdjacentTemplatedNodeArgs?: { [K in keyof G['nodes']]?: (arg: any) => any } } }>();
        queue.push({ name: targetNodeName, node: target as any, arg });

        const visited = new Set<keyof G['nodes']>();
        while (!queue.isEmpty()) {
            const next = queue.pop()!;
            visited.add(next.name);
            const nextArg = next.arg;

            // If this node does not have mappings, skip
            if (!next.node.mapAdjacentTemplatedNodeArgs) {
                continue;
            }

            const mappings = next.node.mapAdjacentTemplatedNodeArgs;
            for (const edgeKey in mappings) {
                // Add to queue if node hasn't been visited
                const mappedArg = mappings[edgeKey]!(nextArg);
                (edges[edgeKey])[next.name as keyof G['nodes'][any]['edges']] = { navigable: true, arg: mappedArg };
                if (!visited.has(edgeKey)) {
                    queue.push({ name: edgeKey, node: this.graph['nodes'][edgeKey] as { mapAdjacentTemplatedNodeArgs?: { [K in keyof G['nodes']]?: (arg: any) => any } }, arg: mappedArg })
                }
            }
        }
        // END BFS

        return edges;
    }


    async goto(targetNode: keyof G['nodes'], arg: any) {
        const episode = ++this.episode;
        const edges = this.getNavigableEdges(targetNode, arg);

        return new Promise((resolve, reject) => {
            // begin navigation
            (this.algorithmInstance.beginNavigation as ((arg: any) => void))({ currentNode: this.currentNode.name, targetNode, targetNodeArg: arg });
            let isNavigating = false;
            while (isNavigating) { // Allow for cancellation
                if (episode !== this.episode) {
                    resolve({ type: 'cancelled' });
                    return;
                }
            }
            resolve(new Proxy({}, {}));
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

import { Graph, MutationResult, GetNodeArgs, EdgeContext, TransitionResult, Maybe, Mutation } from "./graph-types";
import { GraphAlgorithm, GraphAlgorithmInstance, GraphNavigationResult } from "./algorithm-types";
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
    GraphNavigationResult<G, {
        fields: {
            [FieldName in keyof G['nodes'][NodeName]['fields']]:
            InferCompiledField<G['nodes'][NodeName]['fields'][FieldName]>
        },
        mutations: {
            [FieldName in keyof G['nodes'][NodeName]['mutations']]: InferCompiledMutation<G['nodes'][NodeName]['mutations'][FieldName]>
        }
    }>;

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

    faulted: boolean = false;
    id: GraphInstanceIdentifier;
    state: any;
    algorithmInstance: GraphAlgorithmInstance<G>;
    graph: G;
    episode: number;
    currentEpisode: Promise<any>;
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
        this.currentEpisode = Promise.resolve();
    }



    get currentNode(): CompiledGraphInstanceProps<G>['currentNode'] {
        const currentNode = this.graph.nodes[this.currentNodeName];
        return {
            name: this.currentNodeName,
            fields: (currentNode.fields ? new Proxy(currentNode.fields, this.fieldProxyHandler) : {}) as CompiledGraphInstanceProps<G>['currentNode']['fields'],
            mutations: (currentNode.mutations ? new Proxy(currentNode.mutations, this.mutationProxyHandler) : {}) as CompiledGraphInstanceProps<G>['currentNode']['mutations']
        };
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

    applyMutations(mutations: Array<Mutation<G>>) {
        for (const mutation of mutations) {
            ;
            switch (mutation.type) {
                case 'graph_faulted':

                    break;
                case 'transitioned':
                    this.currentNodeName = mutation.to;
                    break;
                case 'update_state':
                    this.state = mutation.newState;
                    break;
                default:
                    throwIfNotNever(mutation);
            }
        }
    }

    async onExit(nodeName: keyof G['nodes']) {
        const thisNode = this.graph.nodes[nodeName];
        const exitMutations = await (thisNode.onExit?.({ currentState: this.state }) ?? Promise.resolve([]));
        this.applyMutations(exitMutations);

    }

    async onEnter(nodeName: keyof G['nodes']) {
        const thisNode = this.graph.nodes[nodeName];
        const enterMutations = await (thisNode.onEnter?.({ currentState: this.state }) ?? Promise.resolve([]));
        this.applyMutations(enterMutations);

        const assertionCtx = { currentState: this.state };
        const assertions = thisNode.assertions?.({ currentState: this.state }) ?? [];
        try {
            await Promise.all(assertions.map(x => x(assertionCtx)));
        } catch (e) {
            console.error(e);
            this.faulted = true;
        }
    }

    createNodeProxy<Node extends {}>(nodeName: keyof G['nodes'], value: Node): Node {
        return new Proxy(value, {});
    }


    async goto<TargetNode extends keyof G['nodes']>(targetNode: TargetNode, arg: any) {
        // First increase the episode number. This will cancel outstanding episodes
        const episode = ++this.episode;
        const edges = this.getNavigableEdges(targetNode, arg);
        const f = () => new Promise(async (resolve) => {
            let result: Maybe<NavigationResult<G, TargetNode>> = null;

            // Have to check for cancellation before even starting navigation,
            // as a new navigation may have been queued before this one even 
            // started
            if (this.episode !== episode) {
                resolve({ type: 'cancelled' });
                return;
            }
            if (this.faulted) {
                // Another episode may have triggered a fault in the graph
                resolve({ type: 'faulted' });
                return;
            }

            this.algorithmInstance.beginNavigation({ currentNode: this.currentNodeName, targetNode, edges });
            navigationLoop: for (; ;) {
                if (episode !== this.episode) {
                    // Episodes allow for cancellation
                    result = { type: 'cancelled' };
                    break navigationLoop;
                }
                // We shouldn't be in faulted state as checks in the loop body 
                // below should catch the faults before it loops back around
                assert(!this.faulted);

                const nextEdge = this.algorithmInstance.chooseNextEdge({ currentNode: this.currentNodeName, targetNode, edges })
                if (nextEdge === null) {
                    result = { type: 'unreachable' };
                    break navigationLoop;
                }
                // BEGIN ATOMIC SECTION
                // This section should be uninterruptable. An edge transition 
                // must either complete or fail, before a new navigation request
                // is allowed.
                const prevNode = this.graph.nodes[this.currentNodeName];
                const previousNodeName = this.currentNodeName;
                assert(prevNode);
                assert(prevNode.edges && prevNode.edges[nextEdge as keyof G['nodes'][any]['edges']]);
                const currentEdge = (prevNode.edges[nextEdge as keyof G['nodes'][any]['edges']]) as ((ctx: EdgeContext<G>, arg?: any) => Promise<TransitionResult<G>> | TransitionResult<G>);
                assert(currentEdge);
                const currentEdgeInfo = (edges[this.currentNodeName][nextEdge as keyof G['nodes'][any]['edges']]);
                assert(currentEdgeInfo && currentEdgeInfo.navigable);
                const arg = currentEdgeInfo.arg;


                try {
                    await this.onExit(previousNodeName);

                    // Exit Mutations can cause graph to enter faulted state
                    if (this.faulted) {
                        // Episodes allow for cancellation
                        result = { type: 'graph_faulted' };
                        break navigationLoop;
                    }

                    const transitionResult = await Promise.resolve(currentEdge({ currentState: this.state }, arg));
                    // First understand what the transition did to the state of the system

                    // Update state iff necessary
                    if (transitionResult.nextState) {
                        this.state = transitionResult.nextState;
                    }

                    switch (transitionResult.type) {
                        case 'transitioned':
                            this.currentNodeName = nextEdge as keyof G['nodes'];
                            await this.onEnter(this.currentNodeName);
                            break;
                        case 'unexpectedly_transitioned':
                            this.currentNodeName = transitionResult.to;
                            await this.onEnter(this.currentNodeName);
                            break;
                        case 'graph_faulted':
                            this.faulted = true;
                            result = { type: 'graph_faulted' };
                            break navigationLoop;
                        case 'transition_failed':
                            // re-enter current node
                            await this.onEnter(this.currentNodeName);
                            break;
                        default:
                            throwIfNotNever(transitionResult);
                    }
                    // Then tell algorithm about it
                    this.algorithmInstance.postEdgeTransitionAttempt({ currentNode: this.currentNodeName, previousNode: previousNodeName, targetNode, transitionResult, edges });

                    // Enter mutations can cause graph to enter faulted state
                    if (this.faulted) {
                        result = { type: 'graph_faulted' };
                        break navigationLoop;
                    }

                    // Finally make a decision about what to do next
                    switch (transitionResult.type) {
                        case 'transitioned': {
                            if (nextEdge === targetNode) {
                                // We got to the correct node. Need to wrap the node in a proxy to ensure that if we navigate away from the node that it 
                                // throws an appropriate error.
                                result = this.createNodeProxy(targetNode, { type: 'successful', fields: {}, mutations: {} } as ({
                                    type: 'successful',
                                    fields: {
                                        [FieldName in keyof G['nodes'][TargetNode]['fields']]:
                                        InferCompiledField<G['nodes'][TargetNode]['fields'][FieldName]>
                                    },
                                    mutations: {
                                        [FieldName in keyof G['nodes'][TargetNode]['mutations']]: InferCompiledMutation<G['nodes'][TargetNode]['mutations'][FieldName]>
                                    }
                                }));
                                break navigationLoop;
                            } else {
                                ; // Continue with loop
                            }
                            break;
                        }
                        case 'unexpectedly_transitioned': {
                            // Something strange happenened, and now we're in another state
                            break;
                        }
                        case 'transition_failed': {
                            // Transition didn't work
                            if (!transitionResult.canRetryEdge) {
                                // Can't retry, so will need to add the edge to the black list.
                                edges[this.currentNodeName][nextEdge].navigable = false;
                            } else {
                                ; // if we're allowed to try again, continue loop as normal
                            }
                            break;
                        }
                        default:
                            throwIfNotNever(transitionResult);
                    }
                } catch (e) {
                    result = { type: 'error', data: e };
                    break;
                }
                // END ATOMIC SECTION
            }
            assert(result);
            this.algorithmInstance.endNavigation({
                result,
                currentNode: this.faulted ? undefined : this.currentNodeName,
                edges,
                targetNode
            });
            resolve(result);
        });


        this.currentEpisode = this.currentEpisode.then(() => f);
    }
}

function assert(x: any): asserts x {
    if (!x) {
        throw new Error('Expected value to be truthy. Internal error');
    }
}

function throwIfNotNever(x: never): never {
    throw new Error(`Expected ${x} to be never`);
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

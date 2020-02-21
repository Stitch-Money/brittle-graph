import { Graph, MutationResult, GetNodeArgs, EdgeContext, TransitionResult, Maybe, Mutation, FieldContext } from "./graph-types";
import { GraphAlgorithm, GraphAlgorithmInstance, GraphNavigationResult } from "./algorithm-types";
import Queue from 'denque';

export function graph<G extends Graph<G>>(graph: G): G & { __typechecked__: void } {
    return graph as G & { __typechecked__: void };
}

export function assert(x: any): asserts x {
    if (!x) {
        throw new Error('Expected value to be truthy. Internal error');
    }
}

type InferInitializer<G extends Graph<G>, _ extends GraphAlgorithm<G>> =
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

export function hasNodeArg<G extends Graph<G>>(nodeName: keyof G['nodes'], graph: G) {
    for (const otherNodeName in graph.nodes) {
        const otherNode = graph.nodes[otherNodeName];
        if ((otherNode.edges?.[nodeName as any as keyof G['nodes'][any]['edges']] as any)?.length >= 2) {
            return true;
        }
    }
    return false;
}

class CompiledGraphInstanceImpl<G extends Graph<G>> implements CompiledGraphInstanceProps<G> {
    currentNodeName: keyof G['nodes'];

    faulted: boolean = false;
    id: GraphInstanceIdentifier;
    state: any;
    algorithmInstance: GraphAlgorithmInstance<G>;
    graph: G;
    episode: number;
    currentEpisode: Promise<any>;
    fieldProxy = {
        get: (fields: G['nodes'][any]['fields'], prop: string) => {
            if (fields && prop in fields) {
                return (arg: any) => (fields[prop as any])({ currentState: this.state }, arg);
            } else {
                return undefined;
            }
        }
    };

    mutationProxy = {
        get: (mutations: G['nodes'][any]['mutations'], prop: string) => {
            if (mutations && prop in mutations) {
                return async (arg: any) => {
                    const mutationResult = await (mutations[prop as any])({ currentState: this.state }, arg);
                    this.applyMutations(mutationResult.effects ?? []);
                    return mutationResult.result;
                };
            } else {
                return undefined;
            }
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
        if (this.faulted) {
            throw new Error('Graph faulted');
        }
        const currentNode = this.graph.nodes[this.currentNodeName];
        const currentNodeName = this.currentNodeName;
        const currentNodeHandler = {
            get: (obj: any, prop: string) => {
                if (this.faulted) {
                    throw new Error('Graph faulted');
                }
                if (this.currentNodeName !== currentNodeName) {
                    throw new Error(`Attempted to access Node "${currentNodeName}" but currently at Node "${this.currentNodeName}"`);
                } else {
                    return obj[prop];
                }
            }
        };
        return new Proxy({
            name: this.currentNodeName,
            fields: currentNode.fields ? new Proxy(currentNode.fields, this.fieldProxy as ProxyHandler<any>) : {},
            mutations: currentNode.mutations ? new Proxy(currentNode.mutations, this.mutationProxy as ProxyHandler<any>) : {}
        }, currentNodeHandler) as CompiledGraphInstanceProps<G>['currentNode'];
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
            if (node.edges && !!(node.edges as { [_ in keyof G['nodes']]: any })[targetNodeName]) {
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
            const nextNode = next.node;
            visited.add(next.name);
            const nextArg = next.arg;
            const mappings = nextNode.mapAdjacentTemplatedNodeArgs;

            // If this node does not have mappings, skip
            if (!mappings) {
                continue;
            }


            for (const edgeKey in mappings) {
                const mappedArg = mappings[edgeKey]!(nextArg);
                // Need to get all adjacent edges to edge key, THESE edges are now navigable, not the edge itself
                for (const nodeName in this.graph.nodes) {
                    const edgeKeyAsEdge = (edgeKey as keyof G['nodes'][any]['edges']);
                    if (this.graph.nodes[nodeName].edges![edgeKeyAsEdge]) {
                        edges[nodeName][edgeKeyAsEdge] = { navigable: true, arg: mappedArg };
                    }
                }

                // Add to queue if node hasn't been visited
                if (!visited.has(edgeKey)) {
                    const node = this.graph['nodes'][edgeKey] as { mapAdjacentTemplatedNodeArgs?: { [K in keyof G['nodes']]?: (arg: any) => any } };
                    queue.push({ name: edgeKey, node, arg: mappedArg });
                }
            }
        }
        // END BFS

        return edges;
    }

    applyMutations(mutations: Array<Mutation<G>>) {
        for (const mutation of mutations) {
            switch (mutation.type) {
                case 'graph_faulted':
                    this.faulted = true;
                    break;
                case 'transitioned':
                    this.currentNodeName = mutation.to;
                    break;
                case 'update_state':
                    this.state = mutation.nextState;
                    break;
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
        const assertions = thisNode.assertions ?? [];
        try {
            await Promise.all(assertions.map(x => Promise.resolve(x(assertionCtx))))
        } catch (e) {
            console.error('Graph faulted', e);
            this.faulted = true;
        }
    }

    private createSuccessNodeProxy<TargetNode extends keyof G['nodes']>(targetNode: TargetNode, episode: number) {
        const node = this.graph.nodes[targetNode];

        const resultProxyHandler = {
            get: (obj: NavigationResult<G, TargetNode>, prop: keyof NavigationResult<G, TargetNode>) => {
                if (this.faulted) {
                    return ({ type: 'graph_faulted' } as any)[prop];
                }
                else if (this.currentNodeName !== targetNode || this.episode !== episode) {
                    return (({ type: 'expired' }) as any)[prop];
                } else {
                    return obj[prop];
                }
            }
        };

        const resultProxy = new Proxy({
            type: 'successful',
            fields: node.fields ? new Proxy(node.fields, this.fieldProxy as ProxyHandler<any>) : {},
            mutations: node.mutations ? new Proxy(node.mutations, this.mutationProxy as ProxyHandler<any>) : {}
        } as NavigationResult<G, TargetNode>, resultProxyHandler);

        return resultProxy;
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
                resolve({ type: 'graph_faulted' });
                return;
            }

            // If has no node arg, can shortcut as already in correct place
            if (targetNode === this.currentNodeName && !hasNodeArg(targetNode, this.graph)) {
                resolve(this.createSuccessNodeProxy(targetNode, episode));
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
                            break;
                        case 'transition_failed':
                            // re-enter current node
                            if (!transitionResult.canRetryEdge) {
                                // Can't retry, so will need to add the edge to the black list.
                                edges[this.currentNodeName][nextEdge].navigable = false;
                            }
                            await this.onEnter(this.currentNodeName);
                            break;
                    }
                    // Then tell algorithm about it
                    this.algorithmInstance.postEdgeTransitionAttempt({ currentNode: this.currentNodeName, previousNode: previousNodeName, targetNode, transitionResult, edges });

                    // Enter mutations can cause graph to enter faulted state
                    if (this.faulted) {
                        result = { type: 'graph_faulted' };
                        break navigationLoop;
                    }

                    // Finally make a decision about what to do next
                    if (transitionResult.type === 'transitioned' && nextEdge === targetNode) {
                        // We got to the correct node. Need to wrap the node in a proxy to ensure that if we navigate away from the node that it 
                        // throws an appropriate error.
                        result = this.createSuccessNodeProxy(targetNode, episode);
                        break navigationLoop;
                    }
                } catch (e) {
                    result = { type: 'graph_faulted', data: e };
                    this.faulted = true;
                    break navigationLoop;
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

        this.currentEpisode = this.currentEpisode.then(() => f());
        return this.currentEpisode;
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
            get: function (target: CompiledGraphInstanceImpl<G>, prop: string | number | symbol) {
                if (nodeNames.includes(prop as keyof G['nodes'])) {
                    return (args: any) => target.goto(prop as keyof G['nodes'], args);
                } else {
                    return (target as any)[prop];
                }
            }
        };

        this.createInstance = (async (args) => {
            const intialStateAndNode = await graph.initializer(args);
            return new Proxy(
                new CompiledGraphInstanceImpl(graph, intialStateAndNode.currentNode, intialStateAndNode.currentState, guidGenerator(), algorithm.createInstance(graph, intialStateAndNode.currentNode)),
                proxyHandler
            ) as unknown as CompiledGraphInstance<G>;
        }) as InferInitializer<G, A>;
    }
}

export function compileGraph<G extends Graph<G>, A extends GraphAlgorithm<G>>(graph: G & { __typechecked__: void }, algorithm: A): CompiledGraph<G, A> {
    return new CompiledGraphImpl(graph as G, algorithm);
}

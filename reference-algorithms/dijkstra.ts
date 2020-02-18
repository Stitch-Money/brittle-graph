import { GraphAlgorithm, GraphAlgorithmInstance, NavigableEdges } from "../src/algorithm-types";
import { Graph } from "../src/graph-types";
import Queue from 'denque';


function assert(x: any): asserts x {
    if (!x) {
        throw new Error('Expected value to be truthy. Internal error');
    }
}


class DijkstraInstance<G extends Graph<G>> implements GraphAlgorithmInstance<G> {
    path: Queue<keyof G["nodes"]> = new Queue<keyof G["nodes"]>();
    edgeWeights: { [Node in keyof G['nodes']]: { [Edge in keyof G['nodes'][Node]['edges']]: number } };

    constructor(edgeWeights: { [Node in keyof G['nodes']]: { [Edge in keyof G['nodes'][Node]['edges']]: number } }) {
        this.edgeWeights = edgeWeights;
    }

    * getReachableEdges(currentNode: keyof G['nodes'], edges: NavigableEdges<G>): Iterable<(keyof G['nodes'])> {
        const theseEdges: Record<keyof G['nodes'][any]['edges'], { navigable: boolean }> = edges[currentNode];
        for (const edge in theseEdges) {
            if (theseEdges[edge].navigable) {
                yield (edge as unknown as keyof G['nodes']);
            }
        }
    }

    doRoute(edges: NavigableEdges<G>, startNode: keyof G['nodes'], targetNode: keyof G['nodes']) {
        this.path.clear();
        const queue = new Queue();

        const backlinks: { [_ in (keyof G['nodes'])]?: true | (keyof G['nodes']) } = {};
        backlinks[startNode] = true;

        let currentNode = startNode;
        queue.push(currentNode);

        do {
            currentNode = queue.shift();
            for (const edge of this.getReachableEdges(currentNode, edges)) {
                if (!backlinks[edge]) {
                    queue.push(edge);
                    backlinks[edge] = currentNode;
                }
            }
        } while (!queue.isEmpty() && currentNode !== targetNode);


        if (backlinks[targetNode]) {
            currentNode = targetNode;
            this.path.unshift(targetNode);
            while (true) {
                const backlink: (keyof G['nodes']) | true | undefined = backlinks[currentNode];
                assert(backlink);
                if (backlink !== true) {
                    this.path.unshift(backlink);
                    currentNode = backlink;
                } else {
                    break;
                }
            }
            this.path.shift();
        } else {
            ;  // no path
        }
    }

    beginNavigation<CurrentNode extends keyof G["nodes"], TargetNode extends keyof G["nodes"]>(navArgs: { currentNode: CurrentNode; targetNode: TargetNode; edges: { [Node in keyof G["nodes"]]: { [E in keyof G["nodes"][Node]["edges"]]: { navigable: boolean; }; }; }; }): void {
        this.doRoute(navArgs.edges, navArgs.currentNode, navArgs.targetNode);
    }

    chooseNextEdge<CurrentNode extends keyof G["nodes"], TargetNode extends keyof G["nodes"]>(navArgs: { currentNode: CurrentNode; targetNode: TargetNode; edges: { [Node in keyof G["nodes"]]: { [E in keyof G["nodes"][Node]["edges"]]: { navigable: boolean; }; }; }; }): (keyof G["nodes"][CurrentNode]["edges"] | null) {
        return (this.path.peekFront() ?? null) as (keyof G["nodes"][CurrentNode]["edges"] | null);
    }

    postEdgeTransitionAttempt<CurrentNode extends keyof G["nodes"], PrevNode extends keyof G["nodes"], TargetNode extends keyof G["nodes"]>(navArgs: { currentNode: CurrentNode; previousNode: PrevNode; targetNode: TargetNode; transitionResult: import("../src/graph-types").TransitionResult<G>; edges: { [Node in keyof G["nodes"]]: { [E in keyof G["nodes"][Node]["edges"]]: { navigable: boolean; }; }; }; }): void {
        switch (navArgs.transitionResult.type) {
            case 'transitioned':
                this.path.shift();
                break;
            case 'graph_faulted':
                this.path.clear()
                break;
            case 'unexpectedly_transitioned':
                this.doRoute(navArgs.edges, navArgs.currentNode, navArgs.targetNode);
                break;
            case 'transition_failed':
                // Have to reroute as edges might be black listed
                this.doRoute(navArgs.edges, navArgs.currentNode, navArgs.targetNode);
                break;
        }
    }

    endNavigation<TargetNode extends keyof G["nodes"], CurrentNode extends keyof G["nodes"]>(_args: { result: import("../src/algorithm-types").GraphNavigationResult<G, unknown>; edges: { [Node in keyof G["nodes"]]: { [E in keyof G["nodes"][Node]["edges"]]: { navigable: boolean; }; }; }; targetNode: TargetNode; currentNode?: CurrentNode | undefined; }): void {
        this.path.clear();
    }

}

export class Dijkstra<G extends Graph<G>> implements GraphAlgorithm<G> {
    edgeWeights: { [Node in keyof G['nodes']]: { [Edge in keyof G['nodes'][Node]['edges']]: number } };
    constructor(edgeWeights: { [Node in keyof G['nodes']]: { [Edge in keyof G['nodes'][Node]['edges']]: number } }) {
        this.edgeWeights = edgeWeights;
    }

    createInstance(graph: G): GraphAlgorithmInstance<G> {
        return new DijkstraInstance<G>(this.edgeWeights);
    }
}

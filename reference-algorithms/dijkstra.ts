import { GraphAlgorithm, GraphAlgorithmInstance, NavigableEdges } from "../src/algorithm-types";
import { Graph } from "../src/graph-types";
import PriorityQueue from 'tinyqueue';
import Queue from 'denque';
import { getReachableEdges, followBacklinks } from "./common";


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

    doRoute(edges: NavigableEdges<G>, startNode: keyof G['nodes'], targetNode: keyof G['nodes']) {
        this.path.clear();
        const queue = new PriorityQueue<{ cost: number, node: keyof G['nodes'] }>([], function (a: { cost: number }, b: { cost: number }) {
            return a.cost - b.cost;
        });

        const backlinks: { [_ in (keyof G['nodes'])]?: (keyof G['nodes']) } = {};

        const costs: { [_ in (keyof G['nodes'])]?: number } = {};
        const visited: Set<keyof G['nodes']> = new Set();

        let currentNode = startNode;
        queue.push({ cost: 0, node: currentNode });

        while (!queue.peek() != null) {
            let { node: currentNode, cost } = queue.pop()!;
            visited.add(currentNode);
            for (const edge of getReachableEdges(currentNode, edges)) {
                let tentativeCost = cost;
                tentativeCost += this.edgeWeights[currentNode][edge as keyof G['nodes'][any]['edges']];
                const prevCost = costs[edge] ?? Infinity;
                const currentCost = prevCost > tentativeCost ? tentativeCost : prevCost;
                if (prevCost > tentativeCost) {
                    costs[edge] = currentCost;
                    backlinks[edge] = currentNode;
                }
                if (!visited.has(edge)) {
                    queue.push({ cost: currentCost, node: edge });
                }
            }
        };

        followBacklinks(this.path, backlinks, targetNode, startNode);
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
        for (const nodeName in this.edgeWeights) {
            for (const edgeName in this.edgeWeights[nodeName]) {
                if (this.edgeWeights[nodeName][edgeName] < 0) {
                    throw new Error(
                        `Edge linking ${nodeName} to ${edgeName} cannot take on a value of less than zero 
                    when using Dijkstra's algorithm as this will result in an infinite loop`)
                }
            }
        }
    }

    createInstance(graph: G): GraphAlgorithmInstance<G> {
        return new DijkstraInstance<G>(this.edgeWeights);
    }
}

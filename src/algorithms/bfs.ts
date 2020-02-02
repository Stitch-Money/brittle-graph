import { GraphAlgorithm, getReachableEdges, Node, Edge, UnsignedFloat, UnweightedGraphRepresention, isValidEdge } from '../abstractions';
import Queue from 'denque'

type BfsState = { path: null | Queue<Edge> };
type BfsParameters = {};

// TODO: add support for blacklist
function getPathWithFewestEdges(graph: UnweightedGraphRepresention, startNode: Node, targetNode: Node, arg: any): { path: null | Queue<Edge> } {
    const queue = new Queue();
    queue.push(startNode);

    // Special case handling for if you're starting on a node with the same node, but a different arg
    if (startNode === targetNode && isValidEdge(graph.nodes[startNode]?.edges[targetNode], arg)) {
        return { path: new Queue<Edge>([startNode as Edge]) };
    }

    const backlinks: { [key: string]: Node | true } = { [startNode]: true };

    let currentNode: Node = startNode;

    do {
        currentNode = queue.shift();
        for (const edge of getReachableEdges(arg, graph, currentNode)) {
            if (!backlinks[edge]) {
                queue.push(edge);
                backlinks[edge] = currentNode;
            }
        }
    } while (!queue.isEmpty() && currentNode !== targetNode);

    if (!backlinks[targetNode]) {
        return { path: null };
    } else {
        currentNode = targetNode;
        const path = new Queue<Edge>();
        while (currentNode != startNode) {
            path.unshift(backlinks[currentNode] as Edge);
            currentNode = backlinks[currentNode] as Node;
        }
        return { path };
    }
}

export const bfs: GraphAlgorithm<BfsParameters, BfsState> = {
    initialParameters: (graph) => ({}),
    applyDigest: (p1, p2) => ({}),

    serializeDigest: (p) => p,
    deserializeDigest: (p) => ({}),

    initialGraphAlgorithmState: (initializeArgs) => ({ path: null }),

    beginNavigation: (navArgs) => getPathWithFewestEdges(navArgs.graph, navArgs.graphState.currentNode, navArgs.targetNode, navArgs.targetNodeArg),

    choseNextEdge: (navArgs) => {
        if (navArgs.algorithmState.path) {
            return navArgs.algorithmState.path.peekFront()!;
        } else {
            return null;
        }
    },
    nextStateAfterEdgeTransitionAttempted: (navArgs) => {
        if (navArgs.transitionResult.type == 'transition_succeeded') {
            navArgs.algorithmState.path?.shift();
            return { path: navArgs.algorithmState.path }
        } else {
            switch (navArgs.transitionResult.reason) {
                case 'graph_faulted':
                case 'unreachable':
                    return { path: null }
                case 'unexpected_transition':
                    return getPathWithFewestEdges(navArgs.graph, navArgs.graphState.currentNode, navArgs.targetNode, navArgs.targetNodeArg);
                case 'error':
                    // TODO, blacklist edge if it cannot retry
                    return getPathWithFewestEdges(navArgs.graph, navArgs.graphState.currentNode, navArgs.targetNode, navArgs.targetNodeArg);
            }
        }
    },

    endNavigation: (args) => [{ path: null }, args.prevParameters],
    receiveNewParameters: (args) => args.prevAlgorithmState
};

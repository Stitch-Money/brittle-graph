import { NavigableEdges } from "../algorithm-types";
import { Graph } from "../graph-types";
import Queue from 'denque';

export function* getReachableEdges<G extends Graph<G>>(currentNode: keyof G['nodes'], edges: NavigableEdges<G>): Iterable<(keyof G['nodes'])> {
    const theseEdges: Record<keyof G['nodes'][any]['edges'], { navigable: boolean }> = edges[currentNode];
    for (const edge in theseEdges) {
        if (theseEdges[edge].navigable) {
            yield (edge as unknown as keyof G['nodes']);
        }
    }
}

export function followBacklinks<G extends Graph<G>>(path: Queue<keyof G["nodes"]>, backlinks: { [_ in (keyof G['nodes'])]?: (keyof G['nodes']) }, targetNode: keyof G['nodes'], startNode: keyof G['nodes']) {
    if (backlinks[targetNode]) {
        let currentNode = targetNode;
        for (; ;) {
            const backlink: (keyof G['nodes']) = backlinks[currentNode]!;
            path.unshift(currentNode);
            if (!backlink || backlink === startNode) {
                break;
            }
            currentNode = backlink;
        }
    }
}

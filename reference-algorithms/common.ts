import { NavigableEdges } from "../src/algorithm-types";
import { Graph } from "../src/graph-types";
import Queue from 'denque';


function assert(x: any): asserts x {
    if (!x) {
        throw new Error('Expected value to be truthy. Internal error');
    }
}


export function* getReachableEdges<G extends Graph<G>>(currentNode: keyof G['nodes'], edges: NavigableEdges<G>): Iterable<(keyof G['nodes'])> {
    const theseEdges: Record<keyof G['nodes'][any]['edges'], { navigable: boolean }> = edges[currentNode];
    for (const edge in theseEdges) {
        if (theseEdges[edge].navigable) {
            yield (edge as unknown as keyof G['nodes']);
        }
    }
}

export function followBacklinks<G extends Graph<G>>(path: Queue<keyof G["nodes"]>, backlinks: { [_ in (keyof G['nodes'])]?: true | (keyof G['nodes']) } = {}, targetNode: keyof G['nodes']) {
    if (backlinks[targetNode]) {
        let currentNode = targetNode;
        path.unshift(targetNode);
        while (true) {
            const backlink: (keyof G['nodes']) | true | undefined = backlinks[currentNode];
            assert(backlink);
            if (backlink !== true) {
                path.unshift(backlink);
                currentNode = backlink;
            } else {
                break;
            }
        }
        path.shift();
    } else {
        ;  // no path
    }
}
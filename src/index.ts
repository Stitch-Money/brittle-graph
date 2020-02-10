import { Graph } from "./graph-types";
export { Graph } from "./graph-types";


export function graph<G extends Graph<G>>(graph: G): G {
    return graph;
}


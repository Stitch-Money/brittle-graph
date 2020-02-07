import { Graph } from "./public-types";
export { Graph } from "./public-types";

export function graph<G extends Graph<G>>(graph: G): G {
    return graph
}


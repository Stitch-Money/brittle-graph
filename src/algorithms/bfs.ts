import { GraphAlgorithm, GraphAlgorithmInstance } from "../algorithm-types";
import { Graph } from "../graph-types";

export class Bfs<G extends Graph<G>> implements GraphAlgorithm<G> {

    createInstance(graph: G): GraphAlgorithmInstance<G> {
        throw new Error("Method not implemented.");
    }

}
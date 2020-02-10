import { graph } from "./index";
import { Graph, CompiledGraphInstance } from "./public-types";

function spuriousGraphProcessor<G extends Graph<G>>(graph: G): CompiledGraphInstance<G> {
    return {} as CompiledGraphInstance<G>;
}

const typecheckedGraph = graph({
    nodes: {
        INITIAL: {
            edges: {
                CATS: (ctx: any, arg: number) => ({ type: 'transitioned' })
            }
        },
        FROG: {
            edges: {
                CATS: (ctx: any, age: number) => ({ type: 'transitioned' }),
                FROG: (ctx: any, arg: { age: number, name: string }) => arg.age === 23 ? ({ type: 'transitioned' }) : ({ type: 'transitioned' }),
                INITIAL: () => ({ type: 'transitioned' }),
            },
            mapAdjacentTemplatedNodeArgs: {}
        },
        CATS: {
            fields: {
                paws: (ctx, arg: number) => arg * 4,
                feets: (ctx) => 4,
                claws: () => 2,
            },
            mapAdjacentTemplatedNodeArgs: {
                FROG: (arg: number) => ({ name: 'eh', age: 0, height: 11 }),
            },
            edges: {
                FROG: (ctx, arg: { height: number }) => ({ type: 'transitioned' }),
                INITIAL: (ctx, arg: boolean) => ({ type: 'transitioned' })
            }
        }
    }
});

const instanceOfGraph = spuriousGraphProcessor(typecheckedGraph);

let result = instanceOfGraph.CATS(4);

let b = instanceOfGraph.FROG({ age: 34, name: 'henry', height: 23 });

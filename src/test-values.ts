import { graph } from "./index";
import { Graph, CompiledGraphInstance } from "./graph-types";

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
            mutations: {
                jump: async (ctx, howHigh: number) => ({ effects: [{ type: 'transition' }] }),
                jump2: async (ctx) => (({ effects: [] }))
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

(async function f() {
    const instanceOfGraph = spuriousGraphProcessor(typecheckedGraph);

    let result = await instanceOfGraph.CATS(4);
    result.mutations.jump(1);

    let b = instanceOfGraph.FROG({ age: 34, name: 'henry', height: 23 });

}())


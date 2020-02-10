import { graph } from "./index";
import { Graph, CompiledGraphInstance, EdgeContext } from "./graph-types";

function spuriousGraphProcessor<G extends Graph<G>>(graph: G): CompiledGraphInstance<G> {
    return {} as CompiledGraphInstance<G>;
}

type GraphState = { count: number };

const typecheckedGraph = graph({
    nodes: {
        INITIAL: {
            edges: {
                CATS: (ctx: { currentState: GraphState }, arg: number) => ({ type: 'transitioned', cost: 2 })
            }
        },
        FROG: {
            edges: {
                CATS: (ctx: any, age: number) => ({ type: 'transitioned', cost: 2 }),
                FROG: (ctx: any, arg: { age: number, name: string }) => arg.age === 23 ? ({ type: 'transitioned', cost: 30 }) : ({ type: 'transitioned', cost: 1 }),
                INITIAL: () => ({ type: 'transitioned', cost: 2 }),
            },
            mapAdjacentTemplatedNodeArgs: {}
        },
        CATS: {
            fields: {
                paws: (_ctx: any, arg: number) => arg * 4,
                feets: (_ctx: any) => 4,
                claws: () => 2,
            },
            mutations: {
                jump: async (ctx: any, howHigh: number) => ({ result: { value: 'six' }, effects: [{ type: 'transition', to: 'FROG' }] }),
                jump2: async (ctx: any) => (({ effects: [] }))
            },
            mapAdjacentTemplatedNodeArgs: {
                FROG: (arg: number) => ({ name: 'eh', age: 0, height: 11 }),
            },
            edges: {
                FROG: (ctx: any, arg: { height: number }) => ({ type: 'transitioned', cost: 4 }),
                INITIAL: (ctx: any, arg: boolean) => ({ type: 'transitioned', cost: 3 })
            }
        }
    },
    initializer: async (arg: number) => ({ currentNode: 'INITIAL', currentState: { count: 0 } }),
});

(async function f() {
    const instanceOfGraph = spuriousGraphProcessor(typecheckedGraph);

    let result = await instanceOfGraph.CATS(4);
    result.mutations.jump(1);
    let b = instanceOfGraph.FROG({ age: 34, name: 'henry', height: 23 });

}())


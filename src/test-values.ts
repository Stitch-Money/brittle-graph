import { graph, compileGraph } from "./index";


type GraphState = { count: number };

const typecheckedGraph = graph({
    nodes: {
        INITIAL: {
            edges: {
                CATS: () => ({ type: 'transitioned', cost: 2 })
            }
        },
        FROG: {
            edges: {
                CATS: () => ({ type: 'transitioned', cost: 2 }),
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
                jump: async () => ({ result: { value: 'six' }, effects: [{ type: 'transitioned', to: 'FROG' }] }),
                jump2: async () => (({ effects: [] }))
            },
            mapAdjacentTemplatedNodeArgs: {
                FROG: () => ({ name: 'eh', age: 0, height: 11 }),
            },
            edges: {
                FROG: () => ({ type: 'transitioned', cost: 4 }),
                INITIAL: () => ({ type: 'transitioned', cost: 3 })
            }
        }
    },
    initializer: async () => ({ currentNode: 'INITIAL', currentState: { count: 0 } }),
});

(async function f() {
    const compiledGraph = compileGraph(graph(typecheckedGraph), {});
    const instanceOfGraph = await compiledGraph.createInstance(10);
    let result = await instanceOfGraph.CATS(4);
    result.mutations.jump(1);

}())


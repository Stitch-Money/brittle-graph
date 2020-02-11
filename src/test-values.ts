import { graph, compileGraph } from "./index";


type GraphState = { count: number };

const compiledGraph = compileGraph({
    nodes: {
        INITIAL: {
            edges: {
                CATS: (ctx: any, arg: { name: string, age: number, height: number }) => ({ type: 'transitioned', cost: 2 })
            }
        },
        FROG: {
            edges: {
                CATS: (ctx: any, arg: { name: string, age: number, weight: number }) => ({ type: 'transitioned', cost: 2 }),
                FROG: (ctx: any, arg: string) => arg === 'henry' ? ({ type: 'transitioned', cost: 30 }) : ({ type: 'transitioned', cost: 1 }),
                INITIAL: () => ({ type: 'transitioned', cost: 2 }),
            },
            mapAdjacentTemplatedNodeArgs: {
                CATS: (arg: string) => ({ name: 'eh', age: 0, height: 23, weight: 24 }),
                FROG: (arg: string) => arg,
            }
        },
        CATS: {
            fields: {
                paws: (_ctx: any, arg: number) => arg * 4,
                feets: (_ctx: any) => 4,
                claws: () => 2,
            },
            mutations: {
                jump: async (ctx: any, height: number) => ({ result: { value: 'six' }, effects: [{ type: 'transitioned', to: 'FROG' }] }),
                jump2: async () => (({ effects: [] }))
            },
            mapAdjacentTemplatedNodeArgs: {
                FROG: (arg: {
                    name: string;
                    age: number;
                    height: number;
                    weight: number,
                }) => 'henry',
            },
            edges: {
                FROG: (ctx: any, arg: string) => ({ type: 'transitioned', cost: 4 }),
                INITIAL: (ctx: any) => ({ type: 'transitioned', cost: 3 })
            }
        }
    },
    initializer: async (arg: number) => ({ currentNode: 'INITIAL', currentState: { count: 0 } }),
}, {} as any);

(async function f() {

    const instanceOfGraph = await compiledGraph.createInstance(12);
    instanceOfGraph.FROG('hello')
    instanceOfGraph.INITIAL()
    let result = await instanceOfGraph.CATS({ name: 'string', age: 23, weight: 23, height: 48 });
    result.mutations.jump(1);
    result.mutations.jump2();
}())

import { graph, compileGraph } from "../src";
import { Bfs } from "../reference-algorithms/bfs";

type GraphState = {
    hasHat: boolean,
    reliability: number
};

const kiaansHouse = graph({
    nodes: {
        Hallway: {
            fields: {
                describe: () =>
                    `The hallway is largely empty, but there is a hat stand in the 
                     corner, which has a rather fetching top hat on it.`,

            },
            mutations: {
                putOnHat: async (ctx: { currentState: GraphState }) => ({
                    effects: [{ type: 'update_state', newState: { ...ctx.currentState, hasHat: true, } }], result: 'you put on the hat'
                })
            },
            edges: {
                Kitchen: () => ({ type: 'transitioned', cost: 1 }),
                Lounge: () => ({ type: 'transitioned', cost: 1 }),
                Bedroom: () => ({ type: 'transitioned', cost: 1 }),
                Garden: () => ({ type: 'transitioned', cost: 1 }),
            },
            mapAdjacentTemplatedNodeArgs: {}
        },
        Study: {
            edges: {
                Bedroom: () => ({ type: 'transitioned', cost: 1 }),
                Lounge: () => ({ type: 'transitioned', cost: 1 }),
            },
            fields: {
                describe: (ctx: { currentState: GraphState }) =>
                    `The study is rather cluttered, with a large writing desk in the corner.
                     Atop the desk is a grey crystal box.`
            },
            mutations: {
                write: async (_ctx: { currentState: GraphState }, msg: string) => ({ result: 'You wrote a message to Nick, containing the following words: ' + msg })
            }
        },
        Kitchen: {
            edges: {
                Hallway: (_ctx: {}, _arg: string) => ({ type: 'transitioned', cost: 1 }),
                Lounge: () => ({ type: 'transitioned', cost: 1 }),
            },
            fields: {
                describe: () =>
                    `The study is rather cluttered, with a large writing desk in the corner.
                     Atop the desk is a grey crystal box.`
            }
        },
        Bedroom: {
            edges: {
                Bathroom: () => ({ type: 'transitioned', cost: 1 }),
                Study: () => ({ type: 'transitioned', cost: 1 }),
                Hallway: (_ctx: {}, _arg: string) => ({ type: 'transitioned', cost: 1 }),
            }
        },
        Lounge: {
            edges: {
                Study: () => ({ type: 'transitioned', cost: 1 }),
                Hallway: () => ({ type: 'transitioned', cost: 1 }),
                Kitchen: () => ({ type: 'transitioned', cost: 1 }),
            }
        },
        Bathroom: {
            edges: {
                Bedroom: () => ({ type: 'transitioned', cost: 1 }),
            }
        },
        Garden: {
            edges: {
                Kitchen: () => ({ type: 'transitioned', cost: 1 }),
                Lounge: () => ({ type: 'transitioned', cost: 1 }),
                Hallway: () => ({ type: 'transitioned', cost: 1 }),
            }
        }
    },
    initializer: async (arg: { reliability: number }) => ({ currentNode: 'Hallway', currentState: { reliability: arg.reliability, hasHat: false } as GraphState })
});

function assert(x: any): asserts x {
    if (!x) {
        throw new Error('Expected value to be truthy. Internal error');
    }
}

const compiledGraph = compileGraph(kiaansHouse, new Bfs<any>());

describe('Graph Engine', () => {
    test('should be able to navigate to desired state', async () => {
        const graphInstance = await compiledGraph.createInstance({ reliability: 1 });
        const kitchen = await graphInstance.Kitchen();
        expect(kitchen.type).toBe('successful');

        const currentNode = graphInstance.currentNode;
        expect(currentNode.name).toBe('Kitchen');
    });

    test('should be able to access fields in a given state', async () => {
        const graphInstance = await compiledGraph.createInstance({ reliability: 1 });
        const kitchen = await graphInstance.Kitchen();
        assert(kitchen.type === 'successful');
        expect(kitchen.fields.describe()).toBe(kiaansHouse.nodes.Kitchen.fields.describe());

        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Kitchen');
        expect(currentNode.fields.describe()).toBe(kiaansHouse.nodes.Kitchen.fields.describe());
    });

    test('should be able to navigate back to currentNode', async () => {
        const graphInstance = await compiledGraph.createInstance({ reliability: 1 });
        assert(graphInstance.currentNode.name === 'Hallway');
        const hallway = await graphInstance.Hallway('knock knock');

        expect(hallway.type).toBe('successful');
        const currentNode = graphInstance.currentNode;
        expect(currentNode.name).toBe('Hallway');
    });

    test('should be able to access mutations in a given state', async () => {
        const graphInstance = await compiledGraph.createInstance({ reliability: 1 });
        const study = await graphInstance.Study();
        assert(study.type === 'successful');

        expect(await study.mutations.write('Hello Nick')).toBe("You wrote a message to Nick, containing the following words: Hello Nick");

        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Study');
        expect(await currentNode.mutations.write('Hello Nick')).toBe("You wrote a message to Nick, containing the following words: Hello Nick");
    });


    test('context should be injected into a field', async () => {

    });

    test('context should be injected into a mutation', async () => {

    });

    test('proxy should make old pointer to a node invalid if the graph has navigated away', async () => {

    });


})



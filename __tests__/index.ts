import { graph, compileGraph } from "../src";
import { Bfs } from "../reference-algorithms/bfs";

type GraphState = {
    hasHat: boolean,
    bathroomCount: number,
    failAsserts: boolean
};

const kiaansHouse = graph({
    nodes: {
        Hallway: {
            fields: {
                describe: () =>
                    `The hallway is largely empty, but there is a hat stand in the 
                     corner, which has a rather fetching top hat on it.`,
                checkIfWearingHat: (ctx: { currentState: GraphState }) => ctx.currentState.hasHat,
                getBathroomCount: (ctx: { currentState: GraphState }) => ctx.currentState.bathroomCount
            },
            mutations: {
                putOnHat: async (ctx: { currentState: GraphState }) => {
                    if (ctx.currentState.hasHat) {
                        return ({
                            result: 'Already wearing a hat'
                        });
                    } else {
                        return ({
                            effects: [{ type: 'update_state', newState: { ...ctx.currentState, hasHat: true, } }], result: 'you put on the hat'
                        });
                    }

                },
                takeOffHat: async (ctx: { currentState: GraphState }) => {
                    if (!ctx.currentState.hasHat) {
                        return ({
                            result: 'not wearing a hat'
                        });
                    } else {
                        return ({
                            effects: [{ type: 'update_state', newState: { ...ctx.currentState, hasHat: false } }], result: 'you took off the hat'
                        });
                    }
                },
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
                blowUpHouse: async () => ({ effects: [{ type: 'graph_faulted' }] }),
                write: async (_ctx: { currentState: GraphState }, msg: string) => ({ result: 'You wrote a message to Nick, containing the following words: ' + msg })
            }
        },
        Kitchen: {
            assertions: [(ctx: { currentState: GraphState }) => {
                if (ctx.currentState.failAsserts) {
                    throw new Error('Failed Asserts');
                }
            }],
            edges: {
                Hallway: (_ctx: {}, _arg: string) => ({ type: 'transitioned', cost: 1 }),
                Lounge: () => ({ type: 'transitioned', cost: 1 }),
            },
            mutations: {},
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
            onEnter: async (ctx: { currentState: GraphState }) => {
                return [{ type: 'update_state', newState: { ...ctx.currentState, bathroomCount: ctx.currentState.bathroomCount + 1 } }];
            },
            fields: {
                getBathroomCount: (ctx: { currentState: GraphState }) => ctx.currentState.bathroomCount
            },
            edges: {
                Bedroom: () => ({ type: 'transitioned', cost: 1 }),
                Bathroom: () => ({ type: 'transitioned', cost: 1 }),
            }
        },
        Garden: {
            edges: {
                Kitchen: () => ({ type: 'transitioned', cost: 1 }),
                Lounge: () => ({ type: 'transitioned', cost: 1 }),
                Hallway: () => ({ type: 'transitioned', cost: 1 }),
            }
        },
        MagicIsland: {

        }
    },
    initializer: async (arg: { failAsserts: boolean }) => ({ currentNode: 'Hallway', currentState: { hasHat: false, bathroomCount: 0, failAsserts: arg.failAsserts } })
});

function assert(x: any): asserts x {
    if (!x) {
        throw new Error('Expected value to be truthy. Internal error');
    }
}

const compiledGraph = compileGraph(kiaansHouse, new Bfs<any>());

describe('Graph Engine', () => {
    test('should be able to navigate to desired state', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const kitchen = await graphInstance.Kitchen();
        expect(kitchen.type).toBe('successful');

        const currentNode = graphInstance.currentNode;
        expect(currentNode.name).toBe('Kitchen');
    });

    test('should be able to access fields in a given state', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const kitchen = await graphInstance.Kitchen();
        assert(kitchen.type === 'successful');
        expect(kitchen.fields.describe()).toBe(kiaansHouse.nodes.Kitchen.fields.describe());

        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Kitchen');
        expect(currentNode.fields.describe()).toBe(kiaansHouse.nodes.Kitchen.fields.describe());
    });

    test('should be able to navigate back to currentNode', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        assert(graphInstance.currentNode.name === 'Hallway');
        const hallway = await graphInstance.Hallway('knock knock');

        expect(hallway.type).toBe('successful');
        const currentNode = graphInstance.currentNode;
        expect(currentNode.name).toBe('Hallway');
    });

    test('should be able to access mutations in a given state', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const study = await graphInstance.Study();
        assert(study.type === 'successful');

        expect(await study.mutations.write('Hello Nick')).toBe("You wrote a message to Nick, containing the following words: Hello Nick");

        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Study');
        expect(await currentNode.mutations.write('Hello Nick')).toBe("You wrote a message to Nick, containing the following words: Hello Nick");
    });

    test('mutations should be able to use update state side effect', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        expect(currentNode.fields.checkIfWearingHat()).toBeFalsy();
        await currentNode.mutations.putOnHat();
        expect(currentNode.fields.checkIfWearingHat()).toBeTruthy();
    });


    test('context should be injected into a field', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        expect(currentNode.fields.checkIfWearingHat()).toBeFalsy();
        await currentNode.mutations.putOnHat();
        expect(currentNode.fields.checkIfWearingHat()).toBeTruthy();
    });

    test('context should be injected into a mutation', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        await currentNode.mutations.putOnHat();
        await currentNode.mutations.takeOffHat();
        const result = await currentNode.mutations.takeOffHat();
        expect(result).toBe('not wearing a hat');
    });

    test('node proxy should make old pointer to a node invalid if the graph has navigated away', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const kitchen = await graphInstance.Kitchen();
        expect(graphInstance.currentNode.name).toBe('Kitchen');
        await graphInstance.Study();
        expect(graphInstance.currentNode.name).toBe('Study');
        expect(kitchen.type).toBe('expired');
    });

    test('current node proxy should throw if the graph has navigated away', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        await graphInstance.Kitchen();
        const currentNode = graphInstance.currentNode;
        await graphInstance.Study();
        expect(() => currentNode.name).toThrow();
    });

    test('inexistent fields in node proxy should return undefined', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const kitchen = (await graphInstance.Kitchen()) as any;
        expect(kitchen.fields).toBeTruthy();
        expect(kitchen.fields.fuzz).toBe(undefined);
    });

    test('inexistent mutations in node proxy should return undefined', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const kitchen = (await graphInstance.Kitchen()) as any;
        expect(kitchen.mutations.fuzz).toBe(undefined);
        expect(kitchen.mutations).toBeTruthy();
    });

    test('inexistent fields in current node proxy should return undefined', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        (await graphInstance.Kitchen());
        const currentNode = graphInstance.currentNode;
        expect(currentNode.fields).toBeTruthy();
        expect((currentNode.fields as any).fuzz).toBe(undefined);
    });

    test('inexistent mutations in current node proxy should return undefined', async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        (await graphInstance.Kitchen());
        const currentNode = graphInstance.currentNode;
        expect(currentNode.mutations).toBeTruthy();
        expect((currentNode.mutations as any).fuzz).toBe(undefined);
    });

    test(`if node is unreachable, graph engine should return {type: 'unreachable'}`, async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const result = await graphInstance.MagicIsland();
        expect(result.type).toBe('unreachable');
    });

    test(`if graph is faulted, attempting to retrieve the current node should throw an error`, async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const result = await graphInstance.Study();
        assert(result.type === 'successful');
        await result.mutations.blowUpHouse();
        expect(() => graphInstance.currentNode).toThrowError();
    });

    test(`if graph is faulted, after retrieving a node, attempting to access a field on the node should throw an error`, async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const result = await graphInstance.Study();
        assert(result.type === 'successful');
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Study');
        await result.mutations.blowUpHouse();
        expect(() => currentNode.name).toThrowError();
    });

    test(`if already at a node that doesn't require args, should not re-enter`, async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const r1 = await graphInstance.Bathroom();
        assert(r1.type === 'successful');
        assert(r1.fields.getBathroomCount() === 1);

        const r2 = await graphInstance.Bathroom();
        assert(r2.type === 'successful');
        expect(r2.fields.getBathroomCount()).toBe(1);

        await graphInstance.Bedroom();

        // Navigating away and back however should cause re-entry
        const r3 = await graphInstance.Bathroom();
        assert(r3.type === 'successful');
        expect(r3.fields.getBathroomCount()).toBe(2);
    });

    test(`onEnter should be called`, async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: false });
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        assert(currentNode.fields.getBathroomCount() === 0);

        const r1 = await graphInstance.Bathroom();
        assert(r1.type === 'successful');
        expect(r1.fields.getBathroomCount()).toBe(1);
    });

    test(`failing asserts should fail graph`, async () => {
        const graphInstance = await compiledGraph.createInstance({ failAsserts: true });
        const r1 = await graphInstance.Kitchen();
        expect(r1.type).toBe('graph_faulted');
        expect(() => graphInstance.currentNode).toThrowError();
    });

});

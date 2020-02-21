import { graph, compileGraph, assert, hasNodeArg } from "../src/index";
import { Bfs } from "../src/reference-algorithms/bfs";



describe('has node arg', () => {
    test('should return false if has no node args', () => {
        const graphG = graph({
            nodes: {
                Start: {
                },
                End: {
                    edges: {
                        Start: async () => ({ type: 'transitioned', cost: 1 })
                    }
                }
            },
            initializer: async () => ({ currentNode: 'Start', currentState: 'hello' })
        });

        expect(hasNodeArg('Start', graphG)).toBeFalsy();
    });

    test('should return true if has node args', () => {
        const graphG = graph({
            nodes: {
                Start: {
                    edges: {}
                },
                End: {
                    edges: {
                        Start: async (_ctx: { currentState: string }, _arg: number) => ({ type: 'transitioned', cost: 1 })
                    }
                }
            },
            initializer: async () => ({ currentNode: 'Start', currentState: 'hello' })
        });

        expect(hasNodeArg('Start', graphG)).toBeTruthy();
    });

});


describe('assert', () => {
    test('should not throw if true', () => {
        expect(assert(true)).toBeUndefined();
    });

    test('should throw if false', () => {
        expect(() => assert(false)).toThrow();
    });
});

type HouseState = {
    hasHat: boolean,
    bathroomCount: number,
    failAsserts: boolean,
    failOnExit: boolean,
    hasJacket: boolean,
    studyCount: number,
    bedroomEdgeCount: number,
    transitionFailure?: 'transient' | 'permanent' | 'critical' | 'unexpected' | 'throwing'
};

type HouseContext = { currentState: HouseState };

function delay<F extends () => any>(f: F, duration: number): Promise<F extends () => infer Result ? Result : never> {
    return new Promise<F extends () => infer Result ? Result : never>((resolve) => {
        setTimeout(async () => resolve(await Promise.resolve(f())), duration);
    });
}

const kiaansHouse = graph({
    nodes: {
        Hallway: {
            fields: {
                describe: () =>
                    `The hallway is largely empty, but there is a hat stand in the 
                     corner, which has a rather fetching top hat on it.`,
                checkIfWearingHat: (ctx: HouseContext) => ctx.currentState.hasHat,
                checkIfWearingJacket: (ctx: HouseContext) => ctx.currentState.hasJacket,
                getBathroomCount: (ctx: HouseContext) => ctx.currentState.bathroomCount,
                getBedroomEdgeCount: (ctx: HouseContext) => ctx.currentState.bedroomEdgeCount
            },
            mutations: {
                putOnHat: async (ctx: HouseContext) => {
                    if (ctx.currentState.hasHat) {
                        return ({
                            result: 'Already wearing a hat'
                        });
                    } else {
                        return ({
                            effects: [{ type: 'update_state', nextState: { ...ctx.currentState, hasHat: true, } }], result: 'you put on the hat'
                        });
                    }

                },
                takeOffHat: async (ctx: HouseContext) => {
                    if (!ctx.currentState.hasHat) {
                        return ({
                            result: 'not wearing a hat'
                        });
                    } else {
                        return ({
                            effects: [{ type: 'update_state', nextState: { ...ctx.currentState, hasHat: false } }], result: 'you took off the hat'
                        });
                    }
                },
            },
            edges: {
                Kitchen: async () => ({ type: 'transitioned', cost: 1 }),
                Lounge: async (ctx: HouseContext) => ({ type: 'transitioned', cost: 1, nextState: { ...ctx.currentState, hasJacket: false } }),
                Bedroom: async (ctx: HouseContext) => {
                    const nextState = { ...ctx.currentState, bedroomEdgeCount: ctx.currentState.bedroomEdgeCount + 1 }
                    switch (ctx.currentState.transitionFailure) {
                        case undefined:
                            return ({ type: 'transitioned', cost: 1, nextState });
                        case 'throwing':
                            throw new Error('Synthetic failure');
                        case 'unexpected':
                            return ({ type: 'unexpectedly_transitioned', to: 'Study', cost: 1, nextState: { ...nextState, transitionFailure: undefined } });
                        case 'critical':
                            return ({ type: 'graph_faulted' });
                        case 'permanent':
                            return ({ type: 'transition_failed', cost: 1, canRetryEdge: false, nextState });
                        case 'transient':
                            return ({ type: 'transition_failed', cost: 1, canRetryEdge: true, nextState: { ...nextState, transitionFailure: undefined } });
                    }
                },
                Garden: async () => ({ type: 'transitioned', cost: 1 }),
            },
            mapAdjacentTemplatedNodeArgs: {}
        },
        Study: {
            onEnter: async (ctx: HouseContext) => [{ type: 'update_state', nextState: { ...ctx.currentState, studyCount: ctx.currentState.studyCount + 1 } }],
            edges: {
                Bedroom: async () => ({ type: 'transitioned', cost: 1 }),
                Lounge: async () => ({ type: 'transitioned', cost: 1 }),
            },
            fields: {
                describe: (ctx: HouseContext) =>
                    `The study is rather cluttered, with a large writing desk in the corner.
                     Atop the desk is a grey crystal box.`
            },
            mutations: {
                blowUpHouse: async () => ({ effects: [{ type: 'graph_faulted' }] }),
                write: async (_ctx: HouseContext, msg: string) => ({ result: 'You wrote a message to Nick, containing the following words: ' + msg })
            }
        },
        Kitchen: {
            assertions: [(ctx: HouseContext) => {
                if (ctx.currentState.failAsserts) {
                    throw new Error('Failed Asserts');
                }
            }],
            edges: {
                Hallway: async (_ctx: {}, _arg: string) => ({ type: 'transitioned', cost: 1 }),
                Lounge: async () => ({ type: 'transitioned', cost: 1 }),
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
                Bathroom: async () => ({ type: 'transitioned', cost: 1 }),
                Study: async () => ({ type: 'transitioned', cost: 1 }),
                Hallway: async (_ctx: {}, _arg: string) => ({ type: 'transitioned', cost: 1 }),
            },
            mutations: {
                openCupboard: async () => {
                    return { effects: [{ type: 'transitioned', to: 'MagicIsland' }] };
                }
            },
            fields: {
                getBedroomEdgeCount: (ctx: HouseContext) => ctx.currentState.bedroomEdgeCount,
                getStudyCount: (ctx: HouseContext) => ctx.currentState.studyCount
            }
        },
        Lounge: {
            fields: {
                hasJacket: (ctx: HouseContext) => ctx.currentState.hasJacket
            },
            edges: {
                Study: async () => ({ type: 'transitioned', cost: 1 }),
                Hallway: async () => ({ type: 'transitioned', cost: 1 }),
                Kitchen: async () => ({ type: 'transitioned', cost: 1 }),
            }
        },
        Bathroom: {
            onEnter: async (ctx: HouseContext) => {
                return [{ type: 'update_state', nextState: { ...ctx.currentState, bathroomCount: ctx.currentState.bathroomCount + 1 } }];
            },
            fields: {
                getBathroomCount: (ctx: HouseContext) => ctx.currentState.bathroomCount
            },
            edges: {
                Bedroom: async () => ({ type: 'transitioned', cost: 1 }),
                Bathroom: async () => ({ type: 'transitioned', cost: 1 }),
            }
        },
        Garden: {
            onExit: async (ctx: HouseContext) => {
                if (ctx.currentState.failOnExit) {
                    return [{ type: 'graph_faulted' }];
                } else {
                    return [];
                }
            },
            edges: {
                Kitchen: async () => ({ type: 'transitioned', cost: 1 }),
                Lounge: async () => ({ type: 'transitioned', cost: 1 }),
                Hallway: async () => ({ type: 'transitioned', cost: 1 }),
            }
        },
        MagicIsland: {
            edges: {
                Castle: () => delay(() => ({ type: 'transitioned' as 'transitioned', cost: 10 }), 100)
            }
        },
        Castle: {
            edges: {
                Dungeon: () => delay(() => ({ type: 'transitioned' as 'transitioned', cost: 10 }), 200)
            }
        },
        Dungeon: {}
    },
    initializer: async (arg: { failAsserts?: boolean, failOnExit?: boolean, transitionFailure?: HouseState['transitionFailure'] }) => ({
        currentNode: 'Hallway',
        currentState: ({
            hasHat: false,
            bathroomCount: 0,
            hasJacket: true,
            studyCount: 0,
            failAsserts: !!arg.failAsserts,
            failOnExit: !!arg.failOnExit,
            transitionFailure: arg.transitionFailure,
            bedroomEdgeCount: 0
        } as HouseState)
    })
});

const compiledHouseGraph = compileGraph(kiaansHouse, new Bfs<any>());

describe('goto', () => {
    test('should be able to reach desired node if a valid path is available', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const kitchen = await graphInstance.Kitchen();
        expect(kitchen.type).toBe('successful');

        const currentNode = graphInstance.currentNode;
        expect(currentNode.name).toBe('Kitchen');
    });

    test('should cause graph to enter faulted state if an exception is thrown during navigation, and also return error', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ transitionFailure: 'throwing' });
        const bedroom = await graphInstance.Bedroom();
        expect(bedroom.type).toBe('graph_faulted');
        expect(() => graphInstance.currentNode).toThrow();
    });

    test(`should return {type: 'unreachable'} if a node in the graph is unreachable`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const result = await graphInstance.MagicIsland();
        expect(result.type).toBe('unreachable');
    });

    test(`should be able to update graph state when taking an edge`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        expect(currentNode.fields.checkIfWearingJacket()).toBeTruthy();

        const lounge = await graphInstance.Lounge();
        assert(lounge.type === 'successful');
        expect(lounge.fields.hasJacket()).toBeFalsy();
    });

    test(`should not re-enter when attempting navigation to currentNode (without args)`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
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


    test('should be able to navigate back to currentNode (with args)', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        assert(graphInstance.currentNode.name === 'Hallway');
        const hallway = await graphInstance.Hallway('knock knock');

        expect(hallway.type).toBe('successful');
        const currentNode = graphInstance.currentNode;
        expect(currentNode.name).toBe('Hallway');
    });

    test('should try to recover from unexpected transitions', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ transitionFailure: 'unexpected' });
        const bedroom = await graphInstance.Bedroom();
        expect(bedroom.type).toBe('successful');
        assert(bedroom.type === 'successful');
        expect(bedroom.fields.getBedroomEdgeCount()).toBe(1);
        expect(bedroom.fields.getStudyCount()).toBeGreaterThan(0);
    });

    test('should route around permanent transition failures by adding to blacklist', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ transitionFailure: 'permanent' });
        const bedroom = await graphInstance.Bedroom();
        expect(bedroom.type).toBe('successful');
        assert(bedroom.type === 'successful')
        expect(bedroom.fields.getBedroomEdgeCount()).toBe(1);
    });

    test('should retry transient transition failures', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ transitionFailure: 'transient' });
        const bedroom = await graphInstance.Bedroom();
        expect(bedroom.type).toBe('successful');
        assert(bedroom.type === 'successful')
        expect(bedroom.fields.getBedroomEdgeCount()).toBe(2);
    });


    test('should enter a faulted state if an edge returns a transition type of graph_faulted', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ transitionFailure: 'critical' });
        const bedroom = await graphInstance.Bedroom();
        expect(bedroom.type).toBe('graph_faulted');
    });
});

describe('nodeProxy', () => {
    test('should return undefined if node is inexistent', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        expect((graphInstance as any).fuzz).toBeUndefined();
    });

    test(`should have type graph_faulted if the graph faults later on`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ failAsserts: true });
        const study = await graphInstance.Study();
        assert(study.type === 'successful');

        await study.mutations.blowUpHouse();

        expect(study.type).toBe('graph_faulted');
    });

    test('should make old pointer to a node invalid if the graph has navigated away', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const kitchen = await graphInstance.Kitchen();
        expect(graphInstance.currentNode.name).toBe('Kitchen');
        await graphInstance.Study();
        expect(graphInstance.currentNode.name).toBe('Study');
        expect(kitchen.type).toBe('expired');
    });


    test(`should return cancelled if a new navigation was started before this ones started`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const bedroom = await graphInstance.Bedroom();
        assert(bedroom.type === 'successful');
        await bedroom.mutations.openCupboard();
        const castle1 = graphInstance.Castle();
        const castle2 = await graphInstance.Castle();
        expect((await castle1).type).toBe('cancelled');
        expect(castle2.type).toBe('successful');
    });

    test(`should return cancelled if a new navigation was started before this ones was completed`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const bedroom = await graphInstance.Bedroom();
        assert(bedroom.type === 'successful');
        await bedroom.mutations.openCupboard();
        const castle1 = graphInstance.Dungeon();
        await delay(() => { }, 60);
        const castle2 = await graphInstance.Castle();
        expect((await castle1).type).toBe('cancelled');
        expect(castle2.type).toBe('successful');
    });

    test(`should return graph_faulted when starting a new navigation after the graph has faulted `, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ failAsserts: true });
        const r1 = await graphInstance.Kitchen();
        expect(r1.type).toBe('graph_faulted');
        const r2 = await graphInstance.Garden();
        expect(r2.type).toBe('graph_faulted');
    });
});



describe('currentNode', () => {
    test('should throw if the graph has navigated away', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        await graphInstance.Kitchen();
        const currentNode = graphInstance.currentNode;
        await graphInstance.Study();
        expect(() => currentNode.name).toThrow();
    });

    test(`should throw an error if graph is faulted`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const result = await graphInstance.Study();
        assert(result.type === 'successful');
        await result.mutations.blowUpHouse();
        expect(() => graphInstance.currentNode).toThrowError();
    });

});

describe('asserts', () => {
    test(`failing asserts should fail graph`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ failAsserts: true });
        const r1 = await graphInstance.Kitchen();
        expect(r1.type).toBe('graph_faulted');
        expect(() => graphInstance.currentNode).toThrowError();
    });
});

describe('onExit', () => {
    test(`returning graph_faulted as an effect should mark the instance as faulted`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({ failOnExit: true });
        const garden = await graphInstance.Garden();
        assert(garden.type === 'successful');
        const kitchen = await graphInstance.Kitchen();
        expect(kitchen.type).toBe('graph_faulted');
    });
});

describe('onEnter', () => {
    test(`should be called`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        assert(currentNode.fields.getBathroomCount() === 0);

        const r1 = await graphInstance.Bathroom();
        assert(r1.type === 'successful');
        expect(r1.fields.getBathroomCount()).toBe(1);
    });
});


describe('fields', () => {
    test('should be able to be accessed in a given state', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const kitchen = await graphInstance.Kitchen();
        assert(kitchen.type === 'successful');
        expect(kitchen.fields.describe()).toBe(kiaansHouse.nodes.Kitchen.fields.describe());

        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Kitchen');
        expect(currentNode.fields.describe()).toBe(kiaansHouse.nodes.Kitchen.fields.describe());
    });


    test('should have latest context', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        expect(currentNode.fields.checkIfWearingHat()).toBeFalsy();
        await currentNode.mutations.putOnHat();
        expect(currentNode.fields.checkIfWearingHat()).toBeTruthy();
    });


    test(`should throw an error if the graph is faulted`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const result = await graphInstance.Study();
        assert(result.type === 'successful');
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Study');
        await result.mutations.blowUpHouse();
        expect(() => currentNode.name).toThrowError();
    });

    test('inexistent fields in node proxy should return undefined', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const kitchen = (await graphInstance.Kitchen()) as any;
        expect(kitchen.fields).toBeTruthy();
        expect(kitchen.fields.fuzz).toBe(undefined);
    });

    test('that are inexistent current node proxy should return undefined', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        (await graphInstance.Kitchen());
        const currentNode = graphInstance.currentNode;
        expect(currentNode.fields).toBeTruthy();
        expect((currentNode.fields as any).fuzz).toBe(undefined);
    });
});

describe('mutations', () => {
    test('that are inexistent in node proxy should return undefined', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const kitchen = (await graphInstance.Kitchen()) as any;
        expect(kitchen.mutations.fuzz).toBe(undefined);
        expect(kitchen.mutations).toBeTruthy();
    });

    test(`should allow transitions as side effects`, async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const failedToGoToIsland = await graphInstance.MagicIsland();
        expect(failedToGoToIsland.type).toBe('unreachable');
        const bedroom = await graphInstance.Bedroom();
        assert(bedroom.type === 'successful');
        await bedroom.mutations.openCupboard();
        expect(graphInstance.currentNode.name).toBe('MagicIsland');
    });

    test('should have latest context', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        await currentNode.mutations.putOnHat();
        await currentNode.mutations.takeOffHat();
        const result = await currentNode.mutations.takeOffHat();
        expect(result).toBe('not wearing a hat');
    });


    test('should be able to access mutations in a given state', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const study = await graphInstance.Study();
        assert(study.type === 'successful');

        expect(await study.mutations.write('Hello Nick')).toBe("You wrote a message to Nick, containing the following words: Hello Nick");

        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Study');
        expect(await currentNode.mutations.write('Hello Nick')).toBe("You wrote a message to Nick, containing the following words: Hello Nick");
    });

    test('should be able to update state as a side effect', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        const currentNode = graphInstance.currentNode;
        assert(currentNode.name === 'Hallway');
        expect(currentNode.fields.checkIfWearingHat()).toBeFalsy();
        await currentNode.mutations.putOnHat();
        expect(currentNode.fields.checkIfWearingHat()).toBeTruthy();
    });

    test('that are inexistent in current node proxy should return undefined', async () => {
        const graphInstance = await compiledHouseGraph.createInstance({});
        (await graphInstance.Kitchen());
        const currentNode = graphInstance.currentNode;
        expect(currentNode.mutations).toBeTruthy();
        expect((currentNode.mutations as any).fuzz).toBe(undefined);
    });
});



const backlinksGraph = graph({
    nodes: {
        Start: {
            edges: {
                MidNode1: async (ctx: { currentState: {} }, _arg: string) => ({ type: 'transitioned', cost: 1 })
            }
        },
        MidNode1: {
            edges: {
                EndNode1: async (ctx: { currentState: {} }, _arg: { name: string }) => ({ type: 'transitioned', cost: 1 })
            },
        },
        MidNode2: {
            edges: {
                EndNode2: async (ctx: {}, _arg: { name: string }) => ({ type: 'transitioned', cost: 1 })
            }
        },
        EndNode1: {
            edges: {
                Start: async (ctx: { currentState: {} }) => ({ type: 'transitioned', cost: 1 })
            },
            mapAdjacentTemplatedNodeArgs: {
                MidNode1: (arg: { name: string }) => arg.name
            }
        },
        EndNode2: {
            edges: {
                Start: async (ctx: { currentState: {} }) => ({ type: 'transitioned', cost: 1 })
            }
        },
    },
    initializer: async () => ({
        currentNode: 'Start', currentState: {}
    })
});

const compiledBacklinkGraph = compileGraph(backlinksGraph, new Bfs<any>());

describe('Backlinks', () => {
    test('templated connections that include mapAdjacentTemplatedNodeArgs should be reachable', async () => {
        const instance = await compiledBacklinkGraph.createInstance();
        const result = await instance.EndNode1({ name: 'johnson' });
        expect(result.type).toBe('successful');
        expect(instance.currentNode.name).toBe('EndNode1');
    });

    test('templated connections that do not include mapAdjacentTemplatedNodeArgs should not be reachable', async () => {
        const instance = await compiledBacklinkGraph.createInstance();
        const result = await instance.EndNode2({ name: 'johnson' });
        expect(result.type).toBe('unreachable');
        expect(instance.currentNode.name).toBe('Start');
    });
});

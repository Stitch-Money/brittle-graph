import { graph } from "../src";
import { MutationContext } from "../src/graph-types";

type GraphState = {
    hasHat: boolean
};

const kiaansHouse = graph({
    nodes: {
        Hallway: {
            fields: {
                describe: () =>
                    `The hallway is largely empty, but there is a hat stand in the 
                     corner, which has a rather fetching top hat on it.`
            },
            mutations: {
                putOnHat: async (ctx: { currentState: GraphState }) => ({
                    effects: [{ type: 'update_state', newState: { ...ctx.currentState, hasHat: true, } }], result: 'you put on the hat'
                })
            },
            edges: {

            }
        },
        Study: {
            edges: {

            },
            fields: {
                describe: () =>
                    `The study is rather cluttered, with a large writing desk in the corner.
                     Atop the desk is a grey crystal box.`
            }
        },
        Kitchen: {
            edges: {

            },
            fields: {
                describe: () =>
                    `The study is rather cluttered, with a large writing desk in the corner.
                     Atop the desk is a grey crystal box.`
            }
        },
        Bedroom: {
            edges: {

            }
        },
        Lounge: {
            edges: {

            }
        },
        Bathroom: {
            edges: {

            }
        },
        Garden: {
            edges: {

            }
        }
    },
    initializer: async () => ({ currentNode: 'Hallway', currentState: { hasHat: false } as GraphState })
});

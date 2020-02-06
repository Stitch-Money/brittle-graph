import { Graph } from "./public-types";
import { object, string } from "decoders";

function graphAcceptingFunction<G extends Graph<any, G>>(graph: G) {

}

graphAcceptingFunction({
    nodes: {
        INITIAL: {
            edges: {}
        },
        FROG: {
            argDecoder: object({ name: string }),
            fields: {
                legs: (arg: { includeToes: boolean }) => 4
            },
            mapAdjacentTemplatedNodeArgs: {
                CATS: (args: { name: string }) => 'benny'
            }
        },
        CATS: {
            argDecoder: string,
            mapAdjacentTemplatedNodeArgs: {
                FROG: (name: string) => ({ name })
            },
            fields: {
                claws: () => 10,
                legs: (arg: { includeToes: boolean, includeBacklegs: boolean }) => arg.includeBacklegs ? 4 : 2
            },
            edges: {
                FROG: (args: { name: string }) => args.name === 'benny' ? 'transitioned' : 'no transition',
            }
        }
    }
});
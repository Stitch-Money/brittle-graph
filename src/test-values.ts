import { Graph } from "./public-types";
import { object, string } from "decoders";

function graphAcceptingFunction<G extends Graph<G>>(graph: G) {

}

graphAcceptingFunction({
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
            },
        },
        CATS: {
            mapAdjacentTemplatedNodeArgs: {
                FROG: (arg: number) => ({ name: 'eh', age: 0 }),
            },
            edges: {
                FROG: (ctx, arg: { height: number }) => ({ type: 'transitioned' })
            }
        }
    }
});

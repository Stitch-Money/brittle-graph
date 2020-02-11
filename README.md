# Brittle Graph

## What is Brittle Graph?

It's a typescript framework for efficiently navigating between nodes in a directed graph. 

Specifically a directed graph where any given transition may fail, or result in a
transition to an unexpected node. 

Out the box it supports two basic graphing algorithms:
 - BFS (Breadth First Search)
 - Dijkstra's Algorithm

BFS will select paths with the fewest expected number of transitions,
while Dijkstra will select a path with the lowest expected cost.

The design of the library allows for the drop-in replacement of more 
sophisticated algorithms; for example ones which use domain specific heuristics, 
dynamically update expected costs based on observed evidence, or choose paths 
least likely to fail.

## Usage
### Defining your graph

```typescript
const validatedGraph = graph({
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
});
```
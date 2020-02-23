# Brittle Graph
![Node.js CI](https://github.com/Stitch-Money/brittle-graph/workflows/Node.js%20CI/badge.svg?branch=master)

## What is Brittle Graph?

It's a typescript framework for efficiently navigating between nodes in a directed graph. 

Specifically a directed graph where any given transition may fail, or result in a
transition to an unexpected node. 

Out the box it supports the BFS (Breadth First Search) algorithm. BFS will select paths with the fewest expected number of transitions.

The design of the library allows for the drop-in replacement of more 
sophisticated algorithms; for example ones which use domain specific heuristics, 
dynamically update expected costs based on observed evidence, or choose paths 
least likely to fail.

## Examples
See unit tests at https://github.com/Stitch-Money/brittle-graph for a working example

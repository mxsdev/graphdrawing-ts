# graphdrawing-ts

This project is a 1:1 zero-dependency rewrite of PGF's [graphdrawing][gd-doc] module from lua in TypeScript.

It can be used to create graph layouts at run-time and is useful for applications such as data-structure visualization.

**Please note** that this package will require a Node.js `assert` polyfill to run on browsers.

## Usage

As an example, here is how to create a directed 3-cycle:

```typescript
import { useState } from 'react'
import { GraphBuilder, ForceDeclarations, Path } from 'graphdrawing-ts'

const nodeSize = 25
const siblingSep = 20

const builder = new GraphBuilder(ForceDeclarations)

builder
  .pushOption('spring Hu 2006 layout')
  .pushOption('node distance', nodeSize * 3.5)
  .pushOption('sibling sep', siblingSep)

builder.beginGraphDrawingScope().pushLayout()

builder.createVertex("1", undefined, Path.squarePath(nodeSize))
builder.createVertex("2", undefined, Path.squarePath(nodeSize))
builder.createVertex("3", undefined, Path.squarePath(nodeSize))

builder.createEdge("1", "2")
builder.createEdge("1", "3")
builder.createEdge("2", "3")

builder.runGraphDrawingAlgorithm()

const renderedGraph = builder.renderGraph()
```

The resulting `renderedGraph` object has the structure:

```typescript
{
    // ...
    vertices: [
        { name: "1", pos: { x: 0, y: 0 } },
        { name: "2", pos: { x: 0, y: -135.6 } },
        { name: "3", pos: { x: -118.9, y: -67.8 } },
    ]
}
```

Visually:

<p align="center">
  <img src="https://user-images.githubusercontent.com/16108792/206361712-499a0b0e-798f-4a5f-a9ac-eb3ab6b43a49.png" />
</p>

As you can see, the vertices have been positioned in a nice way given the graph structure (that is, triangularly).

For more on using the graphdrawing library, see the [docs][gd-doc].

For more on implementing a front-end (renderer), check out the [react example](examples/react).

## `GraphBuilder`

This package adds a `GraphBuilder` class which acts as a wrapper around `InterfaceToDisplay`, automatically taking care of managing scope height.

## Supported Algorithms

 - [x] Force
 - [x] Trees
 - [x] Layered
 - [ ] Planar
 - [ ] Pedigree
 - [ ] Phylogenetics
 - [ ] Routing

[gd-doc]: https://tikz.dev/gd-usage-tikz

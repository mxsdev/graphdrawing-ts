import { ForceDeclarations, GraphBuilder, Path } from "../src"
import { compareGraphTest, emptyPath, runLua } from "./util"

suite("force", () => {
    test("triangle", () => 
        compareGraphTest(
            renderGraph(builder => 
                builder
                    .createVertex("1", undefined, emptyPath())
                    .createVertex("2", undefined, emptyPath())
                    .createVertex("3", undefined, emptyPath())
                    .createEdge("1", "2")
                    .createEdge("2", "3")
                    .createEdge("1", "3")
            ), 
            "force.lua", "triangle"
        )
    )

    test("lone vertex", () => 
        compareGraphTest(
            renderGraph(builder => 
                builder
                    .createVertex("1", undefined, emptyPath())
                    .createVertex("2", undefined, emptyPath())
                    .createVertex("3", undefined, emptyPath())
                    .createVertex("4", undefined, emptyPath())
                    .createEdge("1", "2")
                    .createEdge("2", "3")
                    .createEdge("1", "3")
            ), 
            "force.lua", "lone vertex"
        )
    )

    test("isolated", () =>
        compareGraphTest(
            renderGraph(builder =>
                builder
                    .createVertex("1", undefined, Path.squarePath(20))
                    .createVertex("2", undefined, Path.squarePath(20))
                    .createVertex("3", undefined, Path.squarePath(20))
            ),
            "force.lua", "isolated"
        )
    )
})

function renderGraph(func: (builder: GraphBuilder<typeof ForceDeclarations>) => void) {
    const builder = new GraphBuilder(ForceDeclarations)

    builder.pushOption('disable random', true)
    builder.pushOption('spring Hu 2006 layout')

    builder.beginGraphDrawingScope().pushLayout()

    func(builder)

    return builder.runGraphDrawingAlgorithm().renderGraph()
}
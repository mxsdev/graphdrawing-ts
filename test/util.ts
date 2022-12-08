import { assert } from "chai";
import { execSync } from "child_process";
import path from "path";
import { Path, RenderGraphResult, Vertex } from "../src";

export function emptyPath() {
    return Path.squarePath(0)
}

type LuaPos = { x: number, y: number }
type LuaNode = { pos: LuaPos, name: string }

export type LuaGraphResult = {
    edges: { head: LuaNode, tail: LuaNode }[],
    nodes: LuaNode[],
}

export function runLua<T = LuaGraphResult>(fileName: string, test: string) {
    return JSON.parse(
        execSync(`lua ${path.join(__dirname, fileName)} "${test}"`)
            .toString()
    ) as T
}

const LUA_EPSILON = Number.EPSILON * 10000

function assertSameNode(vertex: Vertex, luaNode: LuaNode) {
    assert.strictEqual(vertex.name, luaNode.name)
    assert.approximately(vertex.pos.x, luaNode.pos.x, LUA_EPSILON)
    assert.approximately(vertex.pos.y, luaNode.pos.y, LUA_EPSILON)
}

export function assertSameGraph(res: RenderGraphResult, luaRes: LuaGraphResult) {
    assert(res.vertices.length === luaRes.nodes.length)

    for(let i = 0; i < res.vertices.length; i++) {
        assertSameNode(res.vertices[i], luaRes.nodes[i])
    }

    assert(res.edges.length === luaRes.edges.length)

    for(let i = 0; i < res.edges.length; i++) {
        const edge = res.edges[i], luaEdge = luaRes.edges[i]

        assertSameNode(edge.head, luaEdge.head)
        assertSameNode(edge.tail, luaEdge.tail)
    }
}

export function compareGraphTest(res: RenderGraphResult, fileName: string, test: string) {
    assertSameGraph(
        res,
        runLua(fileName, test)
    )
}
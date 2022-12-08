local test_util = require("test.util")
test_util.register(package)
-- package.path = package.path .. ";lib/graphdrawing/lua/?.lua"

-- local lib = require("pgf.gd.lib")
local InterfaceToDisplay = require("pgf.gd.interface.InterfaceToDisplay")

local binding, result = test_util.binding()

InterfaceToDisplay.bind(binding)

require "pgf.gd.force.library"

test_util.test("lone vertex", function ()
    InterfaceToDisplay.pushOption("spring Hu 2006 layout", "main", 1)
    
    local h = 1
    
    InterfaceToDisplay.beginGraphDrawingScope(h)
    InterfaceToDisplay.pushLayout(h + 1)
    
    h = h + 1
    
    InterfaceToDisplay.createVertex("1", nil, test_util.emptyPath(), h)
    InterfaceToDisplay.createVertex("2", nil, test_util.emptyPath(), h)
    InterfaceToDisplay.createVertex("3", nil, test_util.emptyPath(), h)
    InterfaceToDisplay.createVertex("4", nil, test_util.emptyPath(), h)
    
    InterfaceToDisplay.createEdge("1", "2", "->", h)
    InterfaceToDisplay.createEdge("2", "3", "->", h)
    InterfaceToDisplay.createEdge("1", "3", "->", h)
    
    InterfaceToDisplay.runGraphDrawingAlgorithm()
    InterfaceToDisplay.renderGraph()

    return result
end)

test_util.test("triangle", function ()
    InterfaceToDisplay.pushOption("spring Hu 2006 layout", "main", 1)
    
    local h = 1
    
    InterfaceToDisplay.beginGraphDrawingScope(h)
    InterfaceToDisplay.pushLayout(h + 1)
    
    h = h + 1
    
    InterfaceToDisplay.createVertex("1", nil, test_util.emptyPath(), h)
    InterfaceToDisplay.createVertex("2", nil, test_util.emptyPath(), h)
    InterfaceToDisplay.createVertex("3", nil, test_util.emptyPath(), h)
    
    InterfaceToDisplay.createEdge("1", "2", "->", h)
    InterfaceToDisplay.createEdge("2", "3", "->", h)
    InterfaceToDisplay.createEdge("1", "3", "->", h)
    
    InterfaceToDisplay.runGraphDrawingAlgorithm()
    InterfaceToDisplay.renderGraph()

    return result
end)

test_util.test("isolated", function ()
    InterfaceToDisplay.pushOption("spring Hu 2006 layout", "main", 1)
    
    local h = 1
    
    InterfaceToDisplay.beginGraphDrawingScope(h)
    InterfaceToDisplay.pushLayout(h + 1)
    
    h = h + 1
    
    InterfaceToDisplay.createVertex("1", nil, test_util.squarePath(20), h)
    InterfaceToDisplay.createVertex("2", nil, test_util.squarePath(20), h)
    InterfaceToDisplay.createVertex("3", nil, test_util.squarePath(20), h)
    
    InterfaceToDisplay.runGraphDrawingAlgorithm()
    InterfaceToDisplay.renderGraph()

    return result
end)
local M = {}

local JSON = (loadfile("test/json.lua"))()

local function send_result(val)
    print(JSON:encode(val))
end

local function activeTest()
    return arg[1]
end

function M.test(name, run)
    if activeTest() ~= name then
        return
    end

    local old_print = print
    print = function (...) end

    local result = run()
    print = old_print

    send_result(result)
end

math.atan2 = math.atan
math.pow = function (x, y) return x^y end

tex = {
    --- @param fraction_one number
    uniform_rand=function (fraction_one)
        return fraction_one / 2
    end,
    init_rand=function () end
}

function M.register(p) 
    p.path = p.path .. ";./lib/graphdrawing/lua/?.lua"
end

M.register(package)

local lib = require("pgf.gd.lib")
local Binding = require("pgf.gd.bindings.Binding")
local Path = require("pgf.gd.model.Path")
-- local InterfaceToDisplay = require("pgf.gd.interface.InterfaceToDisplay")

function M.binding()
    local binding = lib.class { base_class = Binding }
    local result = { nodes = {}, edges = {} }

    function binding:renderStart() end

    function binding:renderStop() end

    function binding:renderEdge(e)
        table.insert(
            result.edges, 
            { 
                head = {
                    pos = e.head.pos,
                    name = e.head.name,
                },
                tail = {
                    pos = e.tail.pos,
                    name = e.tail.name,
                },
            }
        )
    end

    function binding:renderVertex(v)
        table.insert(
            result.nodes,
            {
                pos = v.pos,
                name = v.name,
            }
        )
    end

    return binding, result
end

function M.boundingBoxRect(min_x, min_y, max_x, max_y)
    return Path.new({
        'moveto',
        min_x, min_y,
        'lineto',
        min_x, max_y,
        'lineto',
        max_x, max_y,
        'closepath',
    })
end

function M.rectPath(width, height)
    return M.boundingBoxRect(-width / 2, -height / 2, width / 2, height / 2)
end

function M.squarePath(size)
    return M.rectPath(size, size)
end

function M.emptyPath()
    return M.squarePath(0)
end

return M
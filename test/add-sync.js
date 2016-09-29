var test = require('tape')
var path = require('path')
var deps = require('../sync')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')

test('sync .add(): cache', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var dep = deps()

  t.ok(!Object.keys(dep._cache).length, 'cache starts empty')
  var deps1 = dep.add(fixture)
  t.ok(Object.keys(dep._cache).length >= 2, 'cache populated')
  var deps2 = dep.add(fixture)
  t.deepEqual(deps1, deps2, 'deps are equivalent')
  t.end()
})

var test = require('tape')
var path = require('path')
var deps = require('../')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')

test('.add(): cache', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var dep = deps()

  t.ok(!Object.keys(dep._cache).length, 'cache starts empty')
  dep.add(fixture, function(err, deps1) {
    if (err) return t.ifError(err)

    t.ok(Object.keys(dep._cache).length >= 2, 'cache populated')
    dep.add(fixture, function(err, deps2) {
      if (err) return t.ifError(err)

      t.deepEqual(deps1, deps2, 'deps are equivalent')
      t.end()
    })
  })
})

var test = require('tape')
var deps = require('../')
var path = require('path')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform-opts/index.glsl')
var pkgjson = path.resolve(__dirname, 'fixtures/transform-opts/package.json')

test('package.json: transform options', function(t) {
  deps(path.dirname(fixture)).add(fixture
    , fs.readFileSync(fixture, 'utf8')
    , function(err, deps) {
      if (err) return t.fail(err)

      var opts = require(pkgjson)
        .glslify
        .transform[0][1]

      t.equal(deps[0].source, '//'+JSON.stringify(opts), 'transformed correctly')
      t.end()
    })
})

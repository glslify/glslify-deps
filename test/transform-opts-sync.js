var test = require('tape')
var deps = require('../sync')
var path = require('path')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform-opts/index.glsl')
var pkgjson = path.resolve(__dirname, 'fixtures/transform-opts/package.json')

test('sync package.json: transform options', function(t) {
  var ds = deps(path.dirname(fixture)).add(fixture)
  var opts = require(pkgjson)
    .glslify
    .transform[0][1]

  t.equal(ds[0].source, '//'+JSON.stringify(opts), 'transformed correctly')
  t.end()
})

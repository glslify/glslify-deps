var test = require('tape')
var path = require('path')
var deps = require('../')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('on("file")', function(t) {
  var depper   = deps()
  var expected = [fixture, another, fakePkg]

  t.plan(3)

  depper.add(fixture, fs.readFileSync(fixture, 'utf8'))
  depper.on('file', function(file) {
    var idx = expected.indexOf(file)
    if (idx !== -1) expected.splice(idx, 1)
    t.ok(idx !== -1, 'matched: ' + file)
  })
})

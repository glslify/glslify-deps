var test = require('tape')
var path = require('path')
var deps = require('../sync')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('sync applyTransforms', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var dep = deps()

  t.plan(2)

  var dst = dep.applyTransforms(fixture, src, [])
  t.equal(src, dst, 'should not transform when list empty')

  dst = dep.applyTransforms(fixture, src, [{
    tr: function(file, src, opts) {
      return src.toUpperCase()
    }
  }])
  t.equal(src.toUpperCase(), dst, 'should transform when supplied a transform')
})

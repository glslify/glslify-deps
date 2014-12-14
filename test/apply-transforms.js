var test = require('tape')
var path = require('path')
var deps = require('../')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('applyTransforms', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var dep = deps()

  t.plan(2)

  dep.applyTransforms(fixture, src, [], function(err, dst) {
    if (err) return t.ifError(err)
    t.equal(src, dst, 'should not transform when list empty')
  })

  dep.applyTransforms(fixture, src
    , [{
      tr: function(file, src, opts, done) {
        done(null, src.toUpperCase())
      }
    }]
    , function(err, dst) {
      if (err) return t.ifError(err)
      t.equal(src.toUpperCase(), dst, 'should transform when supplied a transform')
    })
})

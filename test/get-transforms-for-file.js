var test = require('tape')
var path = require('path')
var deps = require('../')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('getTransformsForFile: package.json', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var dep = deps()

  dep.add(fixture, src, function(err, deps) {
    if (err) return t.fail(err.message)

    t.plan(5)

    dep.getTransformsForFile(fixture, function(err, transforms) {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 1, 'one transform registered')
      t.equal(transforms[0].name, 'glslify-hex', 'correct transform registered')
    })

    dep.getTransformsForFile(another, function(err, transforms) {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 1, 'one transform registered')
      t.equal(transforms[0].name, 'glslify-hex', 'correct transform registered')
    })

    dep.getTransformsForFile(fakePkg, function(err, transforms) {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 0, 'no transforms registered for node_modules')
    })
  })
})

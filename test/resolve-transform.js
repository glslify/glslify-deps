var test = require('tape')
var deps = require('../')
var transformRequire = require('../transform-require')

test('resolveTransform', function(t) {
  var dep = deps(__dirname)

  t.equal(require('glslify-hex'), dep.resolveTransform('glslify-hex'), 'resolves transforms like node')
  t.end()
})

test('resolveTransform with async resolver', function(t) {
  var dep = deps({
    cwd: __dirname,
    transformRequire: transformRequire
  })

  dep.resolveTransform('glslify-hex', function(err, transform) {
    t.true(!err)
    t.equal(require('glslify-hex'), transform, 'resolves transforms like node asynchronously')
    t.end()
  })
})

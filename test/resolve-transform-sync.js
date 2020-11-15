var test = require('tape')
var deps = require('../sync')
var transformResolve = require('../transform-resolve')

test('sync resolveTransform', function(t) {
  var dep = deps(__dirname)

  t.equal(require('glslify-hex'), dep.resolveTransform('glslify-hex'), 'resolves transforms like node')
  t.end()
})

test('sync resolveTransform throws error when resolveTransform is async', function(t) {

  t.throws(function() {
    deps({
      cwd: __dirname,
      transformResolve: transformResolve
    })
  }, Error, 'should throw error')
  t.end()
})

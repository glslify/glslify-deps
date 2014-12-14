var test = require('tape')
var deps = require('../')

test('resolveTransform', function(t) {
  var dep = deps(__dirname)

  t.equal(require('glslify-hex'), dep.resolveTransform('glslify-hex'), 'resolves transforms like node')
  t.end()
})

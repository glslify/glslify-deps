const test = require('tape')
const deps = require('../sync')
const transformRequire = require('../transform-require')

test('sync resolveTransform', (t) => {
  const dep = deps(__dirname)

  t.equal(require('glslify-hex'), dep.resolveTransform('glslify-hex'), 'resolves transforms like node')
  t.end()
})

test('sync resolveTransform throws error when resolveTransform is async', (t) => {

  t.throws(() => {
    deps({
      cwd: __dirname,
      transformRequire: transformRequire
    })
  }, Error, 'should throw error')
  t.end()
})

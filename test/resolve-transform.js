const test = require('tape')
const deps = require('../')
const transformRequire = require('../transform-require')

test('resolveTransform', (t) => {
  const dep = deps(__dirname)

  t.equal(require('glslify-hex'), dep.resolveTransform('glslify-hex'), 'resolves transforms like node')
  t.end()
})

test('resolveTransform with async resolver', (t) => {
  const dep = deps({
    cwd: __dirname,
    transformRequire: transformRequire
  })

  dep.resolveTransform('glslify-hex', (err, transform) => {
    t.true(!err)
    t.equal(require('glslify-hex'), transform, 'resolves transforms like node asynchronously')
    t.end()
  })
})

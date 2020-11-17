const test = require('tape')
const path = require('path')
const deps = require('../')
const fs   = require('fs')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')

test('applyTransforms', (t) => {
  const src = fs.readFileSync(fixture, 'utf8')
  const dep = deps()

  t.plan(2)

  dep.applyTransforms(fixture, src, [], (err, dst) => {
    if (err) return t.ifError(err)
    t.equal(src, dst, 'should not transform when list empty')
  })

  dep.applyTransforms(fixture, src
    , [{
      tr: (file, src, opts, done) => done(null, src.toUpperCase())
    }]
    , (err, dst) => {
      if (err) return t.ifError(err)
      t.equal(src.toUpperCase(), dst, 'should transform when supplied a transform')
    })
})

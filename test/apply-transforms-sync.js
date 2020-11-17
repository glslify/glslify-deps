const test = require('tape')
const path = require('path')
const deps = require('../sync')
const fs = require('fs')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')

test('sync applyTransforms', (t) => {
  const src = fs.readFileSync(fixture, 'utf8')
  const dep = deps()

  t.plan(2)

  let dst = dep.applyTransforms(fixture, src, [])
  t.equal(src, dst, 'should not transform when list empty')

  dst = dep.applyTransforms(fixture, src, [{
    tr: (file, src, opts) => src.toUpperCase()
  }])
  t.equal(src.toUpperCase(), dst, 'should transform when supplied a transform')
})

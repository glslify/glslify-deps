const test = require('tape')
const path = require('path')
const deps = require('../sync')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
const another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
const fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('sync on("file")', (t) => {
  const depper = deps()
  const expected = [fixture, another, fakePkg]

  t.plan(3)

  depper.on('file', (file) => {
    const idx = expected.indexOf(file)
    if (idx !== -1) expected.splice(idx, 1)
    t.ok(idx !== -1, 'matched: ' + file)
  }).add(fixture)
})

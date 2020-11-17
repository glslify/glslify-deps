const test = require('tape')
const path = require('path')
const deps = require('../sync')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')

test('sync .add(): cache', (t) => {
  const dep = deps()

  t.ok(!Object.keys(dep._cache).length, 'cache starts empty')
  const deps1 = dep.add(fixture)
  t.ok(Object.keys(dep._cache).length >= 2, 'cache populated')
  const deps2 = dep.add(fixture)
  t.deepEqual(deps1, deps2, 'deps are equivalent')
  t.end()
})

const test = require('tape')
const path = require('path')
const deps = require('../')
const fs   = require('fs')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')

test('.add(): cache', (t) => {
  const dep = deps()

  t.ok(!Object.keys(dep._cache).length, 'cache starts empty')
  dep.add(fixture, (err, deps1) => {
    if (err) return t.ifError(err)

    t.ok(Object.keys(dep._cache).length >= 2, 'cache populated')
    dep.add(fixture, (err, deps2) => {
      if (err) return t.ifError(err)

      t.deepEqual(deps1, deps2, 'deps are equivalent')
      t.end()
    })
  })
})

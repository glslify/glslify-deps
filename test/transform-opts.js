const test = require('tape')
const deps = require('../')
const path = require('path')

const fixture = path.resolve(__dirname, 'fixtures/transform-opts/index.glsl')
const pkgjson = path.resolve(__dirname, 'fixtures/transform-opts/package.json')

test('package.json: transform options', (t) => {
  deps(path.dirname(fixture)).add(fixture, (err, deps) => {
    if (err) return t.fail(err)

    const opts = require(pkgjson)
      .glslify
      .transform[0][1]

    t.equal(deps[0].source, '//'+JSON.stringify(opts), 'transformed correctly')
    t.end()
  })
})

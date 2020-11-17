const test = require('tape')
const deps = require('../sync')
const path = require('path')

const fixture = path.resolve(__dirname, 'fixtures/transform-opts/index.glsl')
const pkgjson = path.resolve(__dirname, 'fixtures/transform-opts/package.json')

test('sync package.json: transform options', (t) => {
  const ds = deps(path.dirname(fixture)).add(fixture)
  const opts = require(pkgjson)
    .glslify
    .transform[0][1]

  t.equal(ds[0].source, '//'+JSON.stringify(opts), 'transformed correctly')
  t.end()
})

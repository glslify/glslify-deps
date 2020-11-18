const test = require('tape')
const deps = require('../')
const path = require('path')
const fs = require('fs')

const fixture = path.resolve(__dirname, 'fixtures/invalid-package/index.glsl')
const pkgjson = path.resolve(__dirname, 'fixtures/invalid-package/package.json')

test('invalid package.json', (t) => {
  deps().add(fixture, (err, deps) => {
    t.ok(err, 'error reported')

    try {
      JSON.parse(fs.readFileSync(pkgjson, 'utf8'))
    } catch (e) {
      t.equal(err.message, e.message, 'error caused by parsing JSON')
      t.end()
    }
  })
})

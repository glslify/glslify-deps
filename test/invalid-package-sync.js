var test = require('tape')
var deps = require('../sync')
var path = require('path')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/invalid-package/index.glsl')
var pkgjson = path.resolve(__dirname, 'fixtures/invalid-package/package.json')

test('sync invalid package.json', function(t) {
  var err
  try { var ds = deps().add(fixture) }
  catch (e) { err = e }
  t.ok(err, 'error reported')

  try {
    JSON.parse(fs.readFileSync(pkgjson, 'utf8'))
  } catch(e) {
    t.equal(err.message, e.message, 'error caused by parsing JSON')
    t.end()
  }
})

var test = require('tape')
var path = require('path')
var deps = require('../sync')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fake    = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('sync .transform(string)', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var depper = deps()

  depper.transform('glslify-hex')
  var ds = depper.add(fixture)
  t.notEqual(ds[0].source, src, 'source was transformed')
  t.end()
})

test('sync .transform(fn)', function(t) {
  var src = fs.readFileSync(fake, 'utf8')
  var depper = deps()

  depper.transform(function(file, src, opts) {
    return src.toUpperCase()
  })

  var ds = depper.add(fake)
  t.equal(ds[0].source, src.toUpperCase(), 'source was transformed')
  t.end()
})

test('sync .transform(fn, opts)', function(t) {
  var src    = fs.readFileSync(fake, 'utf8')
  var depper = deps()
  var opts   = {
    hello: 'world'
  }

  depper.transform(function(file, src, opts) {
    return '//'+JSON.stringify(opts)
  }, opts)

  var ds = depper.add(fake)
  t.equal(ds[0].source, '//'+JSON.stringify(opts), 'source was transformed')
  t.end()
})

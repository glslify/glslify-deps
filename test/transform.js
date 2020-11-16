var test = require('tape')
var path = require('path')
var deps = require('../')
var fs   = require('fs')
var transformRequire = require('../transform-require')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fake    = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

var suite   = [[
  'transformResolve sync'
], [
  'transformResolve sync', {
    transformRequire: transformRequire
  }]
]

suite.forEach(function(s) {

  var context = s[0]
  var opts    = s[1]

test(context + ' .transform(string)', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var depper = deps(opts)

  depper.transform('glslify-hex')
  depper.add(fixture, function(err, deps) {
    if (err) return t.ifError(err)
    t.notEqual(deps[0].source, src, 'source was transformed')
    t.end()
  })
})

test(context + ' .transform(fn)', function(t) {
  var src = fs.readFileSync(fake, 'utf8')
  var depper = deps(opts)

  depper.transform(function(file, src, opts, done) {
    return done(null, src.toUpperCase())
  })

  depper.add(fake, function(err, deps) {
    if (err) return t.ifError(err)
    t.equal(deps[0].source, src.toUpperCase(), 'source was transformed')
    t.end()
  })
})

test(context + ' .transform(fn, opts)', function(t) {
  var src    = fs.readFileSync(fake, 'utf8')
  var depper = deps(opts)
  var opts   = {
    hello: 'world'
  }

  depper.transform(function(file, src, opts, done) {
    return done(null, '//'+JSON.stringify(opts))
  }, opts)

  depper.add(fake, function(err, deps) {
    if (err) return t.ifError(err)
    t.equal(deps[0].source, '//'+JSON.stringify(opts), 'source was transformed')
    t.end()
  })
})

})

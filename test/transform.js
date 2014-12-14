var test = require('tape')
var path = require('path')
var deps = require('../')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fake    = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('.transform(string)', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var depper = deps()

  depper.transform('glslify-hex')
  depper.add(fixture, src, function(err, deps) {
    if (err) return t.ifError(err)
    t.notEqual(deps[0].source, src, 'source was transformed')
    t.end()
  })
})

test('.transform(fn)', function(t) {
  var src = fs.readFileSync(fake, 'utf8')
  var depper = deps()

  depper.transform(function(file, src, opts, done) {
    return done(null, src.toUpperCase())
  })

  depper.add(fake, src, function(err, deps) {
    if (err) return t.ifError(err)
    t.equal(deps[0].source, src.toUpperCase(), 'source was transformed')
    t.end()
  })
})

test('.transform(fn, opts)', function(t) {
  var src    = fs.readFileSync(fake, 'utf8')
  var depper = deps()
  var opts   = {
    hello: 'world'
  }

  depper.transform(function(file, src, opts, done) {
    return done(null, '//'+JSON.stringify(opts))
  }, opts)

  depper.add(fake, src, function(err, deps) {
    if (err) return t.ifError(err)
    t.equal(deps[0].source, '//'+JSON.stringify(opts), 'source was transformed')
    t.end()
  })
})

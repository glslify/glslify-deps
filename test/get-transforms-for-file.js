var test = require('tape')
var path = require('path')
var deps = require('../')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('getTransformsForFile: package.json', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var dep = deps()

  dep.add(fixture, function(err, deps) {
    if (err) return t.fail(err.message)

    t.plan(13)

    dep.getTransformsForFile(fixture, function(err, transforms) {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 1, 'one transform registered')
      t.equal(transforms[0].name, 'glslify-hex', 'correct transform registered')
      t.equal(transforms[0].opts['option-1'], true, 'boolean option passed through')
      t.equal(transforms[0].opts['option-2'], 42, 'numeric option passed through')
      t.ok(!transforms[0].opts.post, '"post" option is ignored')
      t.ok(!transforms[0].opts.global, '"global" option is ignored')
    })

    dep.getTransformsForFile(another, function(err, transforms) {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 1, 'one transform registered')
      t.equal(transforms[0].name, 'glslify-hex', 'correct transform registered')
      t.equal(transforms[0].opts['option-1'], true, 'boolean option passed through')
      t.equal(transforms[0].opts['option-2'], 42, 'numeric option passed through')
      t.ok(!transforms[0].opts.post, '"post" option is ignored')
      t.ok(!transforms[0].opts.global, '"global" option is ignored')
    })

    dep.getTransformsForFile(fakePkg, function(err, transforms) {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 0, 'no transforms registered for node_modules')
    })
  })
})

test('getTransformsForFile(): errors before .add()', function(t) {
  deps().getTransformsForFile(fixture, function(err, transforms) {
    t.ok(err)
    t.end()
  })
})

test('getTransformsForFile(): global transforms', function(t) {
  var depper = deps()

  function globalTransform(filename, src, opts, done) {
    return done(null, src.toUpperCase())
  }

  depper.transform(globalTransform, { global: true })
  depper.add(fixture, function(err) {
    if (err) return t.ifError(err)

    depper.getTransformsForFile(fakePkg, function(err, transforms) {
      if (err) return t.ifError(err)

      t.ok(transforms.length, 'has transforms applied')

      var lastTr    = transforms[transforms.length - 1].tr
      var hasGlobal = transforms.some(function(tr) {
        return tr.tr === globalTransform
      })

      t.ok(hasGlobal, 'global transform has been included in file')
      t.equal(globalTransform, lastTr, 'global transforms come after local ones')
      t.end()
    })
  })
})

test('getTransformsForFile(): post transforms', function(t) {
  var depper = deps()

  function postTransform(filename, src, opts, done) {
    return done(null, src.toUpperCase())
  }

  depper.transform(postTransform, { post: true })
  depper.add(fixture, function(err) {
    if (err) return t.ifError(err)

    depper.getTransformsForFile(fixture, function(err, transforms) {
      if (err) return t.ifError(err)

      t.equal(transforms.length, 1, 'post transform ignored')
      t.end()
    })
  })
})

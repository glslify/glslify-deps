var test = require('tape')
var path = require('path')
var deps = require('../sync')
var fs   = require('fs')

var fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
var another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
var fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('sync getTransformsForFile: package.json', function(t) {
  var src = fs.readFileSync(fixture, 'utf8')
  var dep = deps()

  var ds = dep.add(fixture)
  t.plan(13)

  var trs0 = dep.getTransformsForFile(fixture)
  t.equal(trs0.length, 1, 'one transform registered')
  t.equal(trs0[0].name, 'glslify-hex', 'correct transform registered')
  t.equal(trs0[0].opts['option-1'], true, 'boolean option passed through')
  t.equal(trs0[0].opts['option-2'], 42, 'numeric option passed through')
  t.ok(!trs0[0].opts.post, '"post" option is ignored')
  t.ok(!trs0[0].opts.global, '"global" option is ignored')

  var trs1 = dep.getTransformsForFile(another)
  t.equal(trs1.length, 1, 'one transform registered')
  t.equal(trs1[0].name, 'glslify-hex', 'correct transform registered')
  t.equal(trs1[0].opts['option-1'], true, 'boolean option passed through')
  t.equal(trs1[0].opts['option-2'], 42, 'numeric option passed through')
  t.ok(!trs1[0].opts.post, '"post" option is ignored')
  t.ok(!trs1[0].opts.global, '"global" option is ignored')

  var trs2 = dep.getTransformsForFile(fakePkg)
  t.equal(trs2.length, 0, 'no transforms registered for node_modules')
})

test('sync getTransformsForFile(): errors before .add()', function(t) {
  var err
  try { var trs = deps().getTransformsForFile(fixture) }
  catch (e) { err = e }
  t.ok(err)
  t.end()
})

test('sync getTransformsForFile(): global transforms', function(t) {
  var depper = deps()

  function globalTransform(filename, src, opts) {
    return src.toUpperCase()
  }

  depper.transform(globalTransform, { global: true })
  depper.add(fixture)

  var transforms = depper.getTransformsForFile(fakePkg)
  t.ok(transforms.length, 'has transforms applied')

  var lastTr    = transforms[transforms.length - 1].tr
  var hasGlobal = transforms.some(function(tr) {
    return tr.tr === globalTransform
  })

  t.ok(hasGlobal, 'global transform has been included in file')
  t.equal(globalTransform, lastTr, 'global transforms come after local ones')
  t.end()
})

test('sync getTransformsForFile(): post transforms', function(t) {
  var depper = deps()

  function postTransform(filename, src, opts, done) {
    return done(null, src.toUpperCase())
  }

  depper.transform(postTransform, { post: true })
  depper.add(fixture)
  var transforms = depper.getTransformsForFile(fixture)
  t.equal(transforms.length, 1, 'post transform ignored')
  t.end()
})

const test = require('tape')
const path = require('path')
const deps = require('../sync')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
const another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
const fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('sync getTransformsForFile: package.json', (t) => {
  const dep = deps()

  dep.add(fixture)
  t.plan(13)

  const trs0 = dep.getTransformsForFile(fixture)
  t.equal(trs0.length, 1, 'one transform registered')
  t.equal(trs0[0].name, 'glslify-hex', 'correct transform registered')
  t.equal(trs0[0].opts['option-1'], true, 'boolean option passed through')
  t.equal(trs0[0].opts['option-2'], 42, 'numeric option passed through')
  t.ok(!trs0[0].opts.post, '"post" option is ignored')
  t.ok(!trs0[0].opts.global, '"global" option is ignored')

  const trs1 = dep.getTransformsForFile(another)
  t.equal(trs1.length, 1, 'one transform registered')
  t.equal(trs1[0].name, 'glslify-hex', 'correct transform registered')
  t.equal(trs1[0].opts['option-1'], true, 'boolean option passed through')
  t.equal(trs1[0].opts['option-2'], 42, 'numeric option passed through')
  t.ok(!trs1[0].opts.post, '"post" option is ignored')
  t.ok(!trs1[0].opts.global, '"global" option is ignored')

  const trs2 = dep.getTransformsForFile(fakePkg)
  t.equal(trs2.length, 0, 'no transforms registered for node_modules')
})

test('sync getTransformsForFile(): errors before .add()', (t) => {
  let err
  try { deps().getTransformsForFile(fixture) } catch (e) { err = e }
  t.ok(err)
  t.end()
})

test('sync getTransformsForFile(): global transforms', (t) => {
  const depper = deps()

  const globalTransform = (filename, src, opts) => {
    return src.toUpperCase()
  }

  depper.transform(globalTransform, { global: true })
  depper.add(fixture)

  const transforms = depper.getTransformsForFile(fakePkg)
  t.ok(transforms.length, 'has transforms applied')

  const lastTr = transforms[transforms.length - 1].tr
  const hasGlobal = transforms.some((tr) => {
    return tr.tr === globalTransform
  })

  t.ok(hasGlobal, 'global transform has been included in file')
  t.equal(globalTransform, lastTr, 'global transforms come after local ones')
  t.end()
})

test('sync getTransformsForFile(): post transforms', (t) => {
  const depper = deps()

  const postTransform = (filename, src, opts, done) => {
    return done(null, src.toUpperCase())
  }

  depper.transform(postTransform, { post: true })
  depper.add(fixture)
  const transforms = depper.getTransformsForFile(fixture)
  t.equal(transforms.length, 1, 'post transform ignored')
  t.end()
})

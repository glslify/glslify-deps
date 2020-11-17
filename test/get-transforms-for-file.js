const test = require('tape')
const path = require('path')
const deps = require('../')
const fs = require('fs')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
const another = path.resolve(__dirname, 'fixtures/transform/another.glsl')
const fakePkg = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('getTransformsForFile: package.json', (t) => {
  const dep = deps()

  dep.add(fixture, (err, deps) => {
    if (err) return t.fail(err.message)

    t.plan(13)

    dep.getTransformsForFile(fixture, (err, transforms) => {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 1, 'one transform registered')
      t.equal(transforms[0].name, 'glslify-hex', 'correct transform registered')
      t.equal(transforms[0].opts['option-1'], true, 'boolean option passed through')
      t.equal(transforms[0].opts['option-2'], 42, 'numeric option passed through')
      t.ok(!transforms[0].opts.post, '"post" option is ignored')
      t.ok(!transforms[0].opts.global, '"global" option is ignored')
    })

    dep.getTransformsForFile(another, (err, transforms) => {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 1, 'one transform registered')
      t.equal(transforms[0].name, 'glslify-hex', 'correct transform registered')
      t.equal(transforms[0].opts['option-1'], true, 'boolean option passed through')
      t.equal(transforms[0].opts['option-2'], 42, 'numeric option passed through')
      t.ok(!transforms[0].opts.post, '"post" option is ignored')
      t.ok(!transforms[0].opts.global, '"global" option is ignored')
    })

    dep.getTransformsForFile(fakePkg, (err, transforms) => {
      if (err) return t.fail(err.message)
      t.equal(transforms.length, 0, 'no transforms registered for node_modules')
    })
  })
})

test('getTransformsForFile(): errors before .add()', (t) => {
  deps().getTransformsForFile(fixture, (err, transforms) => {
    t.ok(err)
    t.end()
  })
})

test('getTransformsForFile(): global transforms', (t) => {
  const depper = deps()

  const globalTransform = (filename, src, opts, done) => done(null, src.toUpperCase())

  depper.transform(globalTransform, { global: true })
  depper.add(fixture, (err) => {
    if (err) return t.ifError(err)

    depper.getTransformsForFile(fakePkg, (err, transforms) => {
      if (err) return t.ifError(err)

      t.ok(transforms.length, 'has transforms applied')

      const lastTr = transforms[transforms.length - 1].tr
      const hasGlobal = transforms.some((tr) => tr.tr === globalTransform)

      t.ok(hasGlobal, 'global transform has been included in file')
      t.equal(globalTransform, lastTr, 'global transforms come after local ones')
      t.end()
    })
  })
})

test('getTransformsForFile(): post transforms', (t) => {
  const depper = deps()

  const postTransform = (filename, src, opts, done) => {
    return done(null, src.toUpperCase())
  }

  depper.transform(postTransform, { post: true })
  depper.add(fixture, (err) => {
    if (err) return t.ifError(err)

    depper.getTransformsForFile(fixture, (err, transforms) => {
      if (err) return t.ifError(err)

      t.equal(transforms.length, 1, 'post transform ignored')
      t.end()
    })
  })
})

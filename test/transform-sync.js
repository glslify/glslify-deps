const test = require('tape')
const path = require('path')
const deps = require('../sync')
const fs   = require('fs')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
const fake    = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

test('sync .transform(string)', (t) => {
  const src = fs.readFileSync(fixture, 'utf8')
  const depper = deps()

  depper.transform('glslify-hex')
  const ds = depper.add(fixture)
  t.notEqual(ds[0].source, src, 'source was transformed')
  t.end()
})

test('sync .transform(fn)', (t) => {
  const src = fs.readFileSync(fake, 'utf8')
  const depper = deps()

  depper.transform((file, src, opts) => {
    return src.toUpperCase()
  })

  const ds = depper.add(fake)
  t.equal(ds[0].source, src.toUpperCase(), 'source was transformed')
  t.end()
})

test('sync .transform(fn, opts)', (t) => {
  const src    = fs.readFileSync(fake, 'utf8')
  const depper = deps()
  const opts   = {
    hello: 'world'
  }

  depper.transform((file, src, opts) => {
    return '//'+JSON.stringify(opts)
  }, opts)

  const ds = depper.add(fake)
  t.equal(ds[0].source, '//'+JSON.stringify(opts), 'source was transformed')
  t.end()
})

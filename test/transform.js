const test = require('tape')
const path = require('path')
const deps = require('../')
const fs = require('fs')
const transformRequire = require('../transform-require')

const fixture = path.resolve(__dirname, 'fixtures/transform/index.glsl')
const fake = path.resolve(__dirname, 'fixtures/node_modules/glsl-fake/index.glsl')

const suite = [[
  'transformResolve sync'
], [
  'transformResolve sync', {
    transformRequire: transformRequire
  }]
]

suite.forEach((s) => {
  const context = s[0]
  const opts = s[1]

  test(context + ' .transform(string)', (t) => {
    const src = fs.readFileSync(fixture, 'utf8')
    const depper = deps(opts)

    depper.transform('glslify-hex')
    depper.add(fixture, (err, deps) => {
      if (err) return t.ifError(err)
      t.notEqual(deps[0].source, src, 'source was transformed')
      t.end()
    })
  })

  test(context + ' .transform(fn)', (t) => {
    const src = fs.readFileSync(fake, 'utf8')
    const depper = deps(opts)

    depper.transform((file, src, opts, done) => {
      return done(null, src.toUpperCase())
    })

    depper.add(fake, (err, deps) => {
      if (err) return t.ifError(err)
      t.equal(deps[0].source, src.toUpperCase(), 'source was transformed')
      t.end()
    })
  })

  test(context + ' .transform(fn, opts)', (t) => {
    const opts = {
      hello: 'world'
    }
    const depper = deps(opts)

    depper.transform((file, src, opts, done) => {
      return done(null, '//' + JSON.stringify(opts))
    }, opts)

    depper.add(fake, (err, deps) => {
      if (err) return t.ifError(err)
      t.equal(deps[0].source, '//' + JSON.stringify(opts), 'source was transformed')
      t.end()
    })
  })
})

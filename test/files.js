const test = require('tape')
const deps = require('../')

test('opts.files: entry file', (t) => {
  const src = [
    'precision mediump float;',
    'void main() {',
    '  gl_FragColor = vec4(a(), 1.0);',
    '}'
  ].join('\n')

  const depper = deps({
    files: { '-': src }
  })

  depper.add('-', (err, deps) => {
    if (err) return t.ifError(err)

    t.equal(deps[0].source, src)
    t.end()
  })
})

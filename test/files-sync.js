const test = require('tape')
const deps = require('../sync')

test('sync opts.files: entry file', (t) => {
  const src = [
    'precision mediump float;',
    'void main() {',
    '  gl_FragColor = vec4(a(), 1.0);',
    '}'
  ].join('\n')

  const depper = deps({
    files: { '-': src }
  })

  const ds = depper.add('-')
  t.equal(ds[0].source, src)
  t.end()
})

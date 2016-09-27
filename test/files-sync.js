var test = require('tape')
var deps = require('../sync')

test('sync opts.files: entry file', function(t) {
  var src = [
      'precision mediump float;'
    , 'void main() {'
    , '  gl_FragColor = vec4(a(), 1.0);'
    , '}'
  ].join('\n')

  var depper = deps({
    files: { '-': src }
  })

  var ds = depper.add('-')
  t.equal(ds[0].source, src)
  t.end()
})

var test = require('tape')
var deps = require('../')

test('opts.files: entry file', function(t) {
  var src = [
      'precision mediump float;'
    , 'void main() {'
    , '  gl_FragColor = vec4(a(), 1.0);'
    , '}'
  ].join('\n')

  var depper = deps({
    files: { '-': src }
  })

  depper.add('-', function(err, deps) {
    if (err) return t.ifError(err)

    t.equal(deps[0].source, src)
    t.end()
  })
})

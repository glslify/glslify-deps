var depper = require('../')()

depper.transform('glslify-hex')
depper.add(__filename, [
    'precision mediump float;'
  , '#pragma glslify: random1 = require(glsl-random, a = b, c = 1.0)'
  , '#pragma glslify: random2 = require(glsl-random, a = b, c = 1.0)'
  , '#pragma glslify: random3 = require(glsl-random, a = b, c = 1.0)'
  , 'void main() {'
  , '  gl_FragColor = vec4(#FFF, 1.0);'
  , '}'
  , '#pragma glslify: export(main)'
].join('\n'), function(err, deps) {
  if (err) throw err

  console.log(JSON.stringify(deps, null, 2))
})

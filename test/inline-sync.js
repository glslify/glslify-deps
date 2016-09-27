var test = require('tape')
var path = require('path')
var deps = require('../sync')

test('sync .inline(): creates a dependency tree from an inline shader source', function(t) {
  var src1 = [
    'precision mediump float;',
    '#pragma glslify: another = require(./fixtures/transform/index.glsl)'
  ].join('\n')

  t.plan(4)

  var tree0 = deps().inline(src1, __dirname)
  t.equal(tree0.length, 4, 'loads the expected amount of files')
  t.equal(tree0[0].source, src1, 'source is equivalent')

  var src2 = [
    'precision mediump float;',
    '#pragma glslify: another = require(./index.glsl)'
  ].join('\n')

  var tree1 = deps().inline(src2, path.join(__dirname, 'fixtures',
  'transform'))
  t.equal(tree1.length, 4, 'loads the expected amount of files')
  t.equal(tree1[0].source, src2, 'source is equivalent')
})

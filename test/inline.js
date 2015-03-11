var test = require('tape')
var path = require('path')
var deps = require('../')

test('.inline(): creates a dependency tree from an inline shader source', function(t) {
  var src1 = [
    'precision mediump float;',
    '#pragma glslify: another = require(./fixtures/transform/index.glsl)'
  ].join('\n')

  t.plan(6)

  deps().inline(src1, __dirname, function(err, tree) {
    t.ifError(err, 'from "./test: traverses without error"')
    t.equal(tree.length, 4, 'loads the expected amount of files')
    t.equal(tree[0].source, src1, 'source is equivalent')
  })

  var src2 = [
    'precision mediump float;',
    '#pragma glslify: another = require(./index.glsl)'
  ].join('\n')

  deps().inline(src2, path.join(__dirname, 'fixtures', 'transform'), function(err, tree) {
    t.ifError(err, 'from "./test/fixtures/transform"')
    t.equal(tree.length, 4, 'loads the expected amount of files')
    t.equal(tree[0].source, src2, 'source is equivalent')
  })
})

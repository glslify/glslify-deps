const test = require('tape')
const path = require('path')
const deps = require('../sync')

test('sync .inline(): creates a dependency tree from an inline shader source', (t) => {
  const src1 = [
    'precision mediump float;',
    '#pragma glslify: another = require(./fixtures/transform/index.glsl)'
  ].join('\n')

  t.plan(4)

  const tree0 = deps().inline(src1, __dirname)
  t.equal(tree0.length, 4, 'loads the expected amount of files')
  t.equal(tree0[0].source, src1, 'source is equivalent')

  const src2 = [
    'precision mediump float;',
    '#pragma glslify: another = require(./index.glsl)'
  ].join('\n')

  const tree1 = deps().inline(src2, path.join(__dirname, 'fixtures',
    'transform'))
  t.equal(tree1.length, 4, 'loads the expected amount of files')
  t.equal(tree1[0].source, src2, 'source is equivalent')
})

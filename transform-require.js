// @ts-check
/** @typedef {import('./depper').GlslTransform} GlslTransform */
const nodeResolve = require('resolve')

/**
 * Async transform resolution in node.
 *
 * Functions are retained as-is.
 * Strings are resolved using node's `require` resolution algorithm,
 * and then required directly.
 *
 * @param {String|GlslTransform} transform
 * @param {object} opts
 * @param {string} opts.cwd current work directory
 * @param {(err: Error, transform?: GlslTransform) => any} cb
 */
const transformRequire = (transform, opts, cb) => {
  const cwd = opts && opts.cwd
  if (typeof transform === 'string') {
    return nodeResolve(transform, {
      basedir: cwd
    }, (err) => {
      if (err) return cb(err)
      cb(null, require(transform))
    })
  }
  process.nextTick(() => {
    cb(null, transform)
  });
}

/**
 * Sync transform resolution in node.
 *
 * Functions are retained as-is.
 * Strings are resolved using node's `require` resolution algorithm,
 * and then required directly.
 *
 * @param {String|GlslTransform} transform
 * @param {object} opts
 * @param {string} opts.cwd current work directory
 * @returns {GlslTransform}
 */
transformRequire.sync = (transform, opts) => {
  const cwd = opts && opts.cwd
  return typeof transform === 'string' ? require(nodeResolve.sync(transform, {
    basedir: cwd
  })) : transform
}

module.exports = transformRequire;

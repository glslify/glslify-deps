var nodeResolve = require('resolve')

/**
 * Resolves a transform.
 *
 * Functions are retained as-is.
 * Strings are resolved using node's `require` resolution algorithm,
 * and then required directly.
 *
 * @param {String|Function} transform
 * @param {opts} opts
 * @param {opts} opts.cwd current work directory
 * @returns {Function} transform function
 */
var transformResolve = function (transform, opts, cb) {
  var cwd = opts && opts.cwd
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

transformResolve.sync = function (transform, opts) {
  var cwd = opts && opts.cwd
  return typeof transform === 'string' ? require(nodeResolve.sync(transform, {
    basedir: cwd
  })) : transform
}

module.exports = transformResolve;

var inherits = require('inherits')
var NodeDepper = require('./node')
var transformResolve = require('./transform-resolve')

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * @class
 * @param {String|({
 *   cwd: String,
 *   transformResolve: Function
 * })} opts The root directory of your shader. Defaults to process.cwd()
 */
function DepperAsync(opts) {
  if (!(this instanceof DepperAsync)) return new DepperAsync(opts)
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.async = true
  // keeps the initial behaviour of transform resolution
  opts.transformResolve = opts.transformResolve || transformResolve.sync
  NodeDepper.call(this, opts);
}

inherits(DepperAsync, NodeDepper)
module.exports = DepperAsync

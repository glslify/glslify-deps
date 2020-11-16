var inherits = require('inherits')
var NodeDepper = require('./node')

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * @class
 * @param {String|({
 *   cwd: String,
 *   transformRequire: Function
 * })} opts The root directory of your shader. Defaults to process.cwd()
 */
function DepperAsync(opts) {
  if (!(this instanceof DepperAsync)) return new DepperAsync(opts)
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.async = true
  NodeDepper.call(this, opts);
}

inherits(DepperAsync, NodeDepper)
module.exports = DepperAsync

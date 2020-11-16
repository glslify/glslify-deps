var inherits = require('inherits')
var NodeDepper = require('./node')
var transformRequire = require('./transform-require')

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
function DepperSync(opts) {
  if (!(this instanceof DepperSync)) return new DepperSync(opts)
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.transformRequire = opts.transformRequire || transformRequire.sync
  NodeDepper.call(this, opts)
}

inherits(DepperSync, NodeDepper)
module.exports = DepperSync

var inherits = require('inherits')
var NodeDepper = require('./node')

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * @class
 * @param {String|({
 *   cwd: String,
 * })} opts The root directory of your shader. Defaults to process.cwd()
 */
function DepperSync(opts) {
  if (!(this instanceof DepperSync)) return new DepperSync(opts)
  NodeDepper.call(this, opts)
}

inherits(DepperSync, NodeDepper)
module.exports = DepperSync

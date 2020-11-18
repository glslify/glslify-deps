const NodeDepper = require('./node')

module.exports = (opts) => {
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.async = true
  return new NodeDepper(opts)
}

// glslify use applyTransforms in old fasion way...
// https://github.com/glslify/glslify/blob/ba9c52c46e10068215290753e99ac516cc02d0d7/transform.js#L246
module.exports.prototype.applyTransforms = NodeDepper.prototype.applyTransforms

module.exports.sync = (opts) => {
  return new NodeDepper(opts)
}

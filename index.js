var NodeDepper = require('./node')

module.exports = function(opts) {
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.async = true
  return NodeDepper(opts)
}

module.exports.sync = NodeDepper

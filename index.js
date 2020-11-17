const NodeDepper = require('./node')

module.exports = (opts) => {
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.async = true
  return new NodeDepper(opts)
}

module.exports.sync = (opts) => {
  return new NodeDepper(opts)
}

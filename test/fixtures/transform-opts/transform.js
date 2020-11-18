const transform = (file, src, opts, done) => {
  const output = '//' + JSON.stringify(opts)
  if (typeof done === 'function') done(null, output)
  return output
}

module.exports = transform
module.exports.sync = transform

module.exports = transform
module.exports.sync = transform

function transform(file, src, opts, done) {
  var output = '//'+JSON.stringify(opts)
  if (typeof done === 'function') done(null, output)
  return output
}

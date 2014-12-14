module.exports = transform

function transform(file, src, opts, done) {
  return done(null, '//'+JSON.stringify(opts))
}

/**
 * Gets glslify transform from given package.json
 *
 * @param {object|string} pkgJson package.json filename path or json
 * @returns {({tr: string, name: string, opts: object})[]}
 */
function getTransformsFromPkg(pkgJson) {
  if (typeof pkgJson === 'string') {
    pkgJson = JSON.parse(pkgJson);
  }

  var transforms = (
    pkgJson['glslify']
  && pkgJson['glslify']['transform']
  || []
  )

  return transforms.map(function(key) {
    var transform = Array.isArray(key)
      ? key
      : [key, {}]

    var key = transform[0]
    var opt = transform[1]

    if (opt) {
      delete opt.global
      delete opt.post
    }

    return { tr: key, opts: opt, name: key }
  });
}

module.exports = {
  getTransformsFromPkg
}

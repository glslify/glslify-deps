var tokenize = require('glsl-tokenizer/string')

function glslifyPreprocessor(data) {
  return /#pragma glslify:/.test(data)
}

function glslifyExport(data) {
  return /#pragma glslify:\s*export\(([^\)]+)\)/.exec(data)
}

function glslifyImport(data) {
  return /#pragma glslify:\s*([^=\s]+)\s*=\s*require\(([^\)]+)\)/.exec(data)
}

function genInlineName() {
  return '__INLINE__' + Math.random()
}


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

/**
 * Extracts preprocessors copying the imports and exports
 * into respective parameters
 * @param {string} source
 * @param {string[]} imports
 * @param {string[]} exports
 */
function extractPreprocessors(source, imports, exports) {
  var tokens = tokenize(source)

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]
    if (token.type !== 'preprocessor') continue

    var data = token.data
    if (!glslifyPreprocessor(data)) continue

    var exp = glslifyExport(data)
    var imp = glslifyImport(data)
    if (exp) exports.push(exp[1])
    if (imp) imports.push(imp[2])
  }
}

function getImportName(imp) {
  return imp
    .split(/\s*,\s*/)
    .shift()
    .trim()
    .replace(/^'|'$/g, '')
    .replace(/^"|"$/g, '')
}

module.exports = {
  getTransformsFromPkg,
  getImportName,
  extractPreprocessors,
  genInlineName
}

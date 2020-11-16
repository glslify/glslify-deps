// @ts-check

var tokenize = require('glsl-tokenizer/string')
var path = require('path')

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
 * @param {object|string} pkgJson package.json string data or json
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

/** Fast apply */
function apply(fn, args) {
  switch(args.length) {
    case 1:
      return fn(args[0])
    case 2:
      return fn(args[0], args[1])
    case 3:
      return fn(args[0], args[1], args[2])
    case 4:
      return fn(args[0], args[1], args[2], args[3])
    default:
      return fn.apply(null, args)
  }
}
/**
 * Takes an sync and async functions and return a function which detects if the last argument
 * is a callback in order to select which flow to use
 * @param {function} sync
 * @param {function} [async]
 * @returns {(...args, done) => any}
 */
function mix(sync, async) {
  return function() {
    if(typeof arguments[arguments.length - 1] === 'function') {
      if (!async) {
        throw Error('There\'s no async function available')
      }
      apply(async, arguments)
    }
    return apply(sync, arguments)
  }
}

function cacheWrap(read, cache) {
  function readFromCache(filename) {
    if (!cache[filename]) {
      cache[filename] = read(filename)
    }
    return cache[filename]
  }

  function readFromCacheAsync(filename, done) {
    if (!cache[filename]) {
      return read(filename, (err, content) => {
        if (err) done(err);
        done(err, cache[filename] = content)
      })
    }
    return process.nextTick(function() {
      done(null, cache[filename])
    })
  }

  return mix(readFromCache, readFromCacheAsync)
}

function parseFiles(files) {
  // resolve all files such that they match
  // all of the paths glslify handles, which are otherwise
  // absolute
  return Object.keys(files).reduce(function(newCache, file) {
    newCache[path.resolve(file)] = files[file]
    return newCache
  }, {})
}

module.exports = {
  getTransformsFromPkg,
  getImportName,
  extractPreprocessors,
  genInlineName,
  cacheWrap,
  mix,
  parseFiles
}

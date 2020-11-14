var tokenize = require('glsl-tokenizer/string')
var findup   = require('@choojs/findup').sync
var fs       = require('graceful-fs')
var inherits = require('inherits')
var path     = require('path')
var Depper = require('./depper')
var {
  glslifyPreprocessor,
  glslifyExport,
  glslifyImport,
} = require('./common.js')

module.exports = DepperSync

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * @class
 * @param {String} cwd The root directory of your shader. Defaults to process.cwd()
 */
inherits(DepperSync, Depper)
function DepperSync(opts) {
  if (!(this instanceof DepperSync)) return new DepperSync(opts)
  Depper.call(this, opts)
}

/**
 * Adds a shader file to the graph, including its dependencies
 * which are resolved in this step. Transforms are also applied
 * in the process too, as they may potentially add or remove dependent
 * modules.
 *
 * @param {String} filename The absolute path of this file.
 * @param {String} src The shader source for this file.
 *
 * Returns an array of dependencies discovered so far as its second argument.
 */
DepperSync.prototype.add = function(filename) {
  var basedir = path.dirname(filename = path.resolve(filename))
  var cache   = this._cache
  var self    = this
  var exports = []
  var imports = []

  var dep = {
      id: this._i++
    , deps: {}
    , file: filename
    , source: null
    , entry: this._i === 1
  }

  this._deps.push(dep)
  var src = this.readFile(filename)
  var trs = self.getTransformsForFile(filename)
  self.emit('file', filename)
  src = self.applyTransforms(filename, src, trs)
  dep.source = src
  extractPreprocessors()

  resolveImports()
  return self._deps

  function extractPreprocessors() {
    var tokens = tokenize(dep.source)

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

  function resolveImports(resolved) {
    imports.forEach(function (imp) {
      var importName = imp.split(/\s*,\s*/).shift()

      importName = importName.trim()
      importName = importName.replace(/^'|'$/g, '')
      importName = importName.replace(/^"|"$/g, '')

      var resolved = self.resolve(importName, { basedir: basedir })
      if (cache[resolved]) {
        dep.deps[importName] = cache[resolved].id
      }
      var i = self._i
      cache[resolved] = self.add(resolved)[i]
      dep.deps[importName] = cache[resolved].id
    })
  }
}

DepperSync.prototype.readFile = function(filename) {
  if (path.basename(filename) !== this._inlineName)
    return this._readFile(filename)

  return this._inlineSource
}

/**
 * Determines which transforms to use for a particular file.
 * The rules here are the same you see in browserify:
 *
 * - your shader files will have your specified transforms applied to them
 * - shader files in node_modules do not get local transforms
 * - all files will apply transforms specified in `glslify.transform` in your
 *   `package.json` file, albeit after any transforms you specified using
 *   `depperSync.transform`.
 *
 * @param {String} filename The absolute path of the file in question.
 */
DepperSync.prototype.getTransformsForFile = function(filename) {
  var self  = this
  var entry = this._deps[0]

  if (!entry) throw new Error(
    'getTransformsForFile may only be called after adding your entry file'
  )

  var entryDir     = path.dirname(path.resolve(entry.file))
  var fileDir      = path.dirname(path.resolve(filename))
  var relative     = path.relative(entryDir, fileDir).split(path.sep)
  var node_modules = relative.indexOf('node_modules') !== -1
  var trLocal      = node_modules ? [] : this._transforms
  var trCache      = this._trCache

  if (trCache[fileDir]) {
    return trCache[fileDir]
  }

  try { var found = findup(fileDir, 'package.json') }
  catch (err) {
    var notFound = err.message === 'not found'
    if (notFound) return register([])
    else throw err
  }

  var pkg = path.join(found, 'package.json')
  var pkgjson = JSON.parse(self.readFile(pkg))

  var transforms = (
       pkgjson['glslify']
    && pkgjson['glslify']['transform']
    || []
  )

  transforms = transforms.map(function(key) {
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
  }).map(function(tr) {
    tr.tr = self.resolveTransform(tr.tr)
    return tr
  })

  return register(transforms)

  function register(transforms) {
    return trCache[fileDir] = trLocal
      .concat(transforms)
      .concat(self._globalTransforms)
  }
}

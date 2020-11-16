var inherits = require('inherits')
var path     = require('path')
var Depper = require('./depper')
var transformResolve = require('./transform-resolve')

var {
  getImportName,
  extractPreprocessors
} = require('./utils');

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * @class
 * @param {String|({
  *   cwd: String,
  *   transformResolve: Function
  * })} opts The root directory of your shader. Defaults to process.cwd()
 */
function DepperSync(opts) {
  if (!(this instanceof DepperSync)) return new DepperSync(opts)
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.transformResolve = opts.transformResolve || transformResolve.sync
  Depper.call(this, opts)
}

/**
 * Adds a shader file to the graph, including its dependencies
 * which are resolved in this step. Transforms are also applied
 * in the process too, as they may potentially add or remove dependent
 * modules.
 *
 * @param {String} filename The absolute path of this file.
 *
 * Returns an array of dependencies discovered so far as its second argument.
 */
DepperSync.prototype.add = function(filename) {
  var basedir = path.dirname(filename = path.resolve(filename))
  var exports = []
  var imports = []

  var dep = this._addDep(filename)
  var src = this.readFile(filename)
  var trs = this.getTransformsForFile(filename)
  this.emit('file', filename)
  src = this.applyTransforms(filename, src, trs)
  dep.source = src
  extractPreprocessors(dep.source, imports, exports)

  this._resolveImports(imports, {
    basedir: basedir,
    deps: dep.deps
  })

  return this._deps
}

/**
 * Internal sync method to retrieve dependencies
 * resolving imports using the internal cache
 *
 * @param {string[]} imports
 * @param {object} opts extends options for https://www.npmjs.com/package/resolve
 * @param {object} opts.deps existing dependencies
 * @return {object} resolved dependencies
 */
DepperSync.prototype._resolveImports = function(imports, opts) {
  var self = this
  var deps = opts && opts.deps || {}

  imports.forEach(function (imp) {
    var importName = getImportName(imp)

    var resolved = self.resolve(importName, opts)
    if (self._cache[resolved]) {
      deps[importName] = self._cache[resolved].id
    }
    var i = self._i
    self._cache[resolved] = self.add(resolved)[i]
    deps[importName] = self._cache[resolved].id
  })

  return deps
}

inherits(DepperSync, Depper)
module.exports = DepperSync

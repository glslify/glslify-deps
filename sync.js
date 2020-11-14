var tokenize = require('glsl-tokenizer/string')
var inherits = require('inherits')
var path     = require('path')
var Depper = require('./depper')

var {
  getImportName,
  extractPreprocessors
} = require('./utils');

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
  extractPreprocessors(dep.source, imports, exports)

  resolveImports()
  return self._deps

  function resolveImports() {
    imports.forEach(function (imp) {
      var importName = getImportName(imp)

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

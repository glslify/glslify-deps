var map      = require('map-limit')
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
function DepperAsync(opts) {
  if (!(this instanceof DepperAsync)) return new DepperAsync(opts)
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.async = true
  // keeps the initial behaviour of transform resolution
  opts.transformResolve = opts.transformResolve || transformResolve.sync
  Depper.call(this, opts);
}

/**
 * Adds a shader file to the graph, including its dependencies
 * which are resolved in this step. Transforms are also applied
 * in the process too, as they may potentially add or remove dependent
 * modules.
 *
 * @param {String} filename The absolute path of this file.
 * @param {Function} done(err, deps)
 *
 * The `done` callback will be called when the entire graph has been
 * resolved, and will include an array of dependencies discovered
 * so far as its second argument.
 */
DepperAsync.prototype.add = function(filename, done) {
  var basedir = path.dirname(filename = path.resolve(filename))
  var self    = this
  var exports = []
  var imports = []

  var dep = this._addDep(filename)
  this.readFile(filename, function(err, src) {
    if (err) return done(err)
    self.getTransformsForFile(filename, function(err, trs) {
      if (err) return done(err)

      self.emit('file', filename)
      self.applyTransforms(filename, src, trs, function(err, src) {
        if (err) return done(err)

        dep.source = src
        extractPreprocessors(dep.source, imports, exports)
        self._resolveImports(imports, {
          deps: dep.deps,
          basedir: basedir
        }, function(err) {
          setTimeout(function() {
            done && done(err, !err && self._deps)
          })
        })
      })
    })
  })

  return dep
}

/**
 * Internal async method to retrieve dependencies
 * resolving imports using the internal cache
 *
 * @param {string[]} imports
 * @param {object} opts extends options for https://www.npmjs.com/package/resolve
 * @param {object} opts.deps existing dependencies
 * @param {(err: Error)} done
 * @return {object} resolved dependencies
 */
DepperAsync.prototype._resolveImports = function(imports, opts, done) {
  var self = this
  var deps = opts && opts.deps || {}
  map(imports, 10, function(imp, next) {
    var importName = getImportName(imp)

    self.resolve(importName, opts, function(err, resolved) {
      if (err) return next(err)

      if (self._cache[resolved]) {
        deps[importName] = self._cache[resolved].id
        return next()
      }

      self._cache[resolved] = self.add(resolved, function(err) {
        if (err) return next(err)
        deps[importName] = self._cache[resolved].id
        next()
      })
    })
  }, done)

  return deps
}

inherits(DepperAsync, Depper)
module.exports = DepperAsync

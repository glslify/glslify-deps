/** @typedef {import('./depper').DepperOptions} DepperOptions */
var Depper   = require('./depper')
var path     = require('path')
var map      = require('map-limit')
var inherits = require('inherits')

var {
  getImportName,
  extractPreprocessors
} = require('./utils');

/**
 *
 * @class
 * @param {DepperOptions} opts
 */
function NodeDepper(opts) {
  if (!(this instanceof NodeDepper)) return new NodeDepper(opts)
  Depper.call(this, opts)
}

/**
 * Adds a shader file to the graph, including its dependencies
 * which are resolved in this step. Transforms are also applied
 * in the process too, as they may potentially add or remove dependent
 * modules.
 *
 * @param {String} filename The absolute path of this file.
 * @param {(err: Error, deps?: object[]) => any} [done]
 *
 * If async is defined then `done` callback will be called when the entire graph has been
 * resolved, and will include an array of dependencies discovered
 * so far as its second argument.
 *
 * If sync returns an array of dependencies discovered so far as its second argument.
 */
NodeDepper.prototype.add = function(filename, done) {
  var basedir = path.dirname(filename = path.resolve(filename))
  var self    = this
  var exports = []
  var imports = []

  var dep = this._addDep(filename)

  if (this._async) {
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

  } else {
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

  return dep
}

/**
 * Internal async method to retrieve dependencies
 * resolving imports using the internal cache
 *
 * @param {string[]} imports
 * @param {object} opts extends options for https://www.npmjs.com/package/resolve
 * @param {object} opts.deps existing dependencies
 * @param {(err: Error) => any} [done]
 * @return {object} resolved dependencies
 */
NodeDepper.prototype._resolveImports = function(imports, opts, done) {
  var self = this
  var deps = opts && opts.deps || {}

  if (this._async) {
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
  } else {
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
  }

  return deps
}

inherits(NodeDepper, Depper)
module.exports = NodeDepper

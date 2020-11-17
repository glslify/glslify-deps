/** @typedef {import('./depper').DepperOptions} DepperOptions */
var Depper   = require('./depper')
var path     = require('path')
var map      = require('map-limit')
var inherits = require('inherits')
var fs       = require('graceful-fs')
var glslResolve = require('glsl-resolve')
var transformRequire = require('./transform-require')

var {
  getImportName,
  extractPreprocessors,
  mix,
  asyncify
} = require('./utils');

function createDefaultRead() {
  function defaultReadAsync(src, done) {
    fs.readFile(src, 'utf8', done)
  }

  function defaultRead(src) {
    return fs.readFileSync(src, 'utf8')
  }

  return mix(defaultRead, defaultReadAsync)
}

/**
 *
 * @class
 * @param {DepperOptions} opts
 */
function NodeDepper(opts) {
  if (!(this instanceof NodeDepper)) return new NodeDepper(opts)
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.resolve = opts.resolve || mix(glslResolve.sync, glslResolve)
  // keeps the original behaviour of transform resolution but overridable
  opts.transformRequire = opts.transformRequire || transformRequire.sync
  opts.readFile = opts.readFile || createDefaultRead()
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

  var process = asyncify(
    function(_, next) {return self.readFile(filename, next) },
    function(_, next) {return self.getTransformsForFile(filename, next) },
    function(result, next) {
      self.emit('file', filename)
      return self.applyTransforms(filename, result[0], result[1], next)
    },
    function(result, next) {
      extractPreprocessors(dep.source = result[2], imports, exports)
      return self._resolveImports(imports, {
          deps: dep.deps,
          basedir: basedir
      }, next)
    }, function(_, next) {
      if(next) {
        next(null, self._deps)
      }
    })


  if (this._async) {
    process(done || function() {
      console.warn('glslify-deps: depper.add() has not a callback defined using async flow')
    })
    return dep
  } else {
    process()
    return this._deps
  }
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
  opts = opts || {}
  var self = this
  var deps = opts.deps || {}
  var parallel = opts.parallel || 10

  var process = asyncify(
    function(result, next) { return self.resolve(result[0], opts, next) },
    function(result, next) {
      var importName = result[0]
      var resolved = result[1]
      if (self._cache[resolved]) {
        deps[importName] = self._cache[resolved].id
        return next && next()
      }
      if (next) {
        self._cache[resolved] = self.add(resolved, function(err) {
          if (err) return next(err)
          deps[importName] = self._cache[resolved].id
          next()
        })
      } else {
        var idx = self._i
        self._cache[resolved] = self.add(resolved)[idx]
        deps[importName] = self._cache[resolved].id
      }
    }
  )

  if (this._async) {
    map(imports, parallel, function(imp, next) {
      process([getImportName(imp)], next)
    }, done)
  } else {
    imports.forEach(function (imp) {
      process([getImportName(imp)])
    })
  }

  return deps
}

inherits(NodeDepper, Depper)
module.exports = NodeDepper

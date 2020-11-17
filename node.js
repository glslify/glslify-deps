/** @typedef {import('./depper').DepperOptions} DepperOptions */
var Depper   = require('./depper')
var path     = require('path')
var map      = require('map-limit')
var inherits = require('inherits')
var fs       = require('graceful-fs')
var findup   = require('@choojs/findup')
var glslResolve = require('glsl-resolve')
var transformRequire = require('./transform-require')

var {
  getImportName,
  extractPreprocessors,
  getTransformsFromPkg,
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
  this._trCache    = {}
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

/**
 * Determines which transforms to use for a particular file.
 * The rules here are the same you see in browserify:
 *
 * - your shader files will have your specified transforms applied to them
 * - shader files in node_modules do not get local transforms
 * - all files will apply transforms specified in `glslify.transform` in your
 *   `package.json` file, albeit after any transforms you specified using
 *   `depper.transform`.
 *
 * @param {String} filename The absolute path of the file in question.
 * @param {(err: Error, transforms?: GlslTransform[]) => any} [done] Applies when async true
 */
NodeDepper.prototype.getTransformsForFile = function(filename, done) {
  var self  = this
  var entry = this._deps[0]

  if (!entry) return done(new Error(
    'getTransformsForFile may only be called after adding your entry file'
  ))

  var entryDir     = path.dirname(path.resolve(entry.file))
  var fileDir      = path.dirname(path.resolve(filename))
  var relative     = path.relative(entryDir, fileDir).split(path.sep)
  var node_modules = relative.indexOf('node_modules') !== -1
  var trLocal      = node_modules ? [] : this._transforms
  var trCache      = this._trCache
  var pkgName      = 'package.json'

  if (trCache[fileDir]) {
    if (this._async) {
      return done(null, trCache[fileDir])
    } else {
      return trCache[fileDir]
    }
  }

  if (this._async) {
    findup(fileDir, pkgName, function(err, found) {
      var notFound = err && err.message === 'not found'
      if (notFound) return register([], done)
      if (err) return done(err)

      var pkg = path.join(found, pkgName)

      self.readFile(pkg, function(err, pkgJson) {
        if (err) return done(err)
        var transforms;
        try {
          transforms = getTransformsFromPkg(pkgJson)
        } catch(e) { return done(e) }

        trCache[fileDir] = self._register(trLocal.concat(transforms), done)
      })
    })
  } else {
    try { var found = findup.sync(fileDir, pkgName) }
    catch (err) {
      var notFound = err.message === 'not found'
      if (notFound) return register([])
      else throw err
    }

    var pkg = path.join(found, pkgName)
    var transforms = getTransformsFromPkg(self.readFile(pkg))

    return trCache[fileDir] = self._register(trLocal.concat(transforms))
  }
}

inherits(NodeDepper, Depper)
module.exports = NodeDepper

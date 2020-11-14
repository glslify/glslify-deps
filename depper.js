var path     = require('path')
var fs       = require('graceful-fs')
var Emitter  = require('events/')
var inherits = require('inherits')
var cacheWrap = require('./cacheWrap')
var nodeResolve = require('resolve')
var glslResolve = require('glsl-resolve')
var findup   = require('@choojs/findup')

var {
  genInlineName,
  getTransformsFromPkg,
} = require('./utils.js')


module.exports = Depper

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * @class
 * @param {String} cwd The root directory of your shader. Defaults to process.cwd()
 */
inherits(Depper, Emitter)
function Depper(opts, async) {
  if (!(this instanceof Depper)) return new Depper(opts)
  Emitter.call(this)

  opts = typeof opts === 'string' ? { cwd: opts } : opts
  opts = opts || {}

  this._async      = opts.async || async
  this._deps       = []
  this._cwd        = opts.cwd || process.cwd()
  this._cache      = {}
  this._i          = 0
  this._transforms = []
  this._trCache    = {}
  this._fileCache  = opts.files || {}

  this._globalTransforms = []

  this._readFile = cacheWrap(opts.readFile || createDefaultRead(this._async), this._fileCache, this._async)
  this.resolve   = opts.resolve || (this._async ? glslResolve : glslResolve.sync)

  this._inlineSource = ''
  this._inlineName = genInlineName()

  if (typeof this._cwd !== 'string') {
    throw new Error('glslify-deps: cwd must be a string path')
  }
}

Depper.prototype.inline = function(source, basedir, done) {
  var inlineFile = path.resolve(basedir || this._cwd, this._inlineName)

  this._inlineSource = source

  if (this._async) {
    this.add(inlineFile, function(err, tree) {
      done && done(err, !err && tree)
    })
  } else {
    return this.add(inlineFile)
  }
}

/**
 * Internal method to add dependencies
 * @param {string} filename
 */
Depper.prototype._addDep = function(filename) {
  var dep = {
    id: this._i++
  , deps: {}
  , file: filename
  , source: null
  , entry: this._i === 1
  }

  this._deps.push(dep)

  return dep;
}


/**
 * Adds a transform to use on your local dependencies.
 * Note that this should be used before calling `add`.
 *
 * Transforms are handled using a different API to browserify, e.g.:
 *
 * ``` js
 * module.exports = function transform(filename, src, opts, done) {
 *   done(null, src.toUpperCase())
 * }
 * ```
 *
 * Where `filename` is the absolute file path, `src` is the shader source
 * as a string, `opts` is an options object for configuration, and `done`
 * is a callback which takes the transformed shader source.
 *
 * @param {String|Function} transform
 * @param {Object} opts
 */
Depper.prototype.transform = function(transform, opts) {
  var name = typeof transform === 'string' ? transform : null
  var list = opts && opts.global
    ? this._globalTransforms
    : this._transforms

  // post transforms are ignored by glslify-deps, to be handled
  // by glslify after the file has been bundled.
  if (opts && opts.post) return this

  transform = this.resolveTransform(transform)
  list.push({ tr: transform, opts: opts, name: name })

  return this
}

/**
 * Resolves a transform.
 *
 * Functions are retained as-is.
 * Strings are resolved using node's `require` resolution algorithm,
 * and then required directly.
 *
 * @param {String|Function} transform
 */
Depper.prototype.resolveTransform = function(transform) {
  if (typeof transform === 'string') {
    transform = nodeResolve.sync(transform, {
      basedir: this._cwd
    })
    if (this._async) {
      transform = require(transform)
    } else {
      var m = require(transform)
      if (!m || typeof m.sync !== 'function') {
        throw new Error('transform ' + transform + ' does not provide a'
          + ' synchronous interface')
      }
      transform = m.sync
    }
  }
  return transform
}

/**
 * Applies a transform to a string.
 *
 * Note that transforms here are passed in differently to other methods:
 * - `tr.tr` should point to the transform function.
 * - `tr.opts` should contain the options for the transform, if applicable.
 *
 * @param {String} filename The absolute path of the file you're transforming.
 * @param {String} src The shader source you'd like to transform.
 * @param {Array} transforms The transforms you'd like to apply.
 * @param {(err: Error, result: string) => any} [done] Applies when async true
 */
Depper.prototype.applyTransforms = function(filename, src, transforms, done) {
  if (this._async) {
    var i = 0

    next(null, src)
    function next(err, updated) {
      if (err) return done(err)
      if (i >= transforms.length) return done(null, updated)

      var tr = transforms[i++]
      var opts = tr.opts

      if (!opts || typeof opts !== 'object') opts = {}
      tr.tr(filename, updated+'', tr.opts, next)
    }
  } else {
    transforms.forEach(function (tr) {
      var opts = tr.opts
      if (!opts || typeof opts !== 'object') opts = {}
      src = tr.tr(filename, src+'', tr.opts)
    })
    return src
  }
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
 * @param {(err: Error, transforms: any) => any} [done] Applies when async true
 */
Depper.prototype.getTransformsForFile = function(filename, done) {
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

  function register(transforms) {
    trCache[fileDir] = trLocal
      .concat(transforms.map(function(tr) {
        tr.tr = self.resolveTransform(tr.tr)
        return tr
      }))
      .concat(self._globalTransforms);
    var result = trCache[fileDir]
    if (self._async) {
      done(null, result)
    } else {
      return result
    }
  }

  if (this._async) {
    findup(fileDir, pkgName, function(err, found) {
      var notFound = err && err.message === 'not found'
      if (notFound) return register([])
      if (err) return done(err)

      var pkg = path.join(found, pkgName)

      self.readFile(pkg, function(err, pkgJson) {
        if (err) return done(err)
        var transforms;
        try {
          transforms = getTransformsFromPkg(pkgJson)
        } catch(e) { return done(e) }

        register(transforms)
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

    return register(getTransformsFromPkg(self.readFile(pkg)))
  }
}

Depper.prototype.readFile = function(filename, done) {
  if (path.basename(filename) !== this._inlineName)
    return this._readFile(filename, done)

  if(this._async) {
    return done(null, this._inlineSource)
  }
  return this._inlineSource
}

function createDefaultRead(async) {
  if (async) {
    return function defaultRead(src, done) {
      fs.readFile(src, 'utf8', done)
    }
  }
  return function defaultRead(src) {
    return fs.readFileSync(src, 'utf8')
  }
}

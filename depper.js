var path     = require('path')
var fs       = require('graceful-fs')
var Emitter  = require('events/')
var inherits = require('inherits')
var cacheWrap = require('./cacheWrap')
var nodeResolve = require('resolve')
var glslResolve = require('glsl-resolve')

var {
  genInlineName,
} = require('./common.js')


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
 * @param {Function} [done] applies when async true
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

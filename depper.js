var path     = require('path')
var fs       = require('graceful-fs')
var Emitter  = require('events/')
var inherits = require('inherits')
var cacheWrap = require('./cacheWrap')
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

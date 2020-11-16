// @ts-check
/** @typedef {import('glsl-resolve')} GlslResolve */
var path     = require('path')
var map      = require('map-limit')
var Emitter  = require('events/')
var inherits = require('inherits')
var findup   = require('@choojs/findup')

var {
  genInlineName,
  getTransformsFromPkg,
  cacheWrap,
  parseFiles,
} = require('./utils.js')


/**
 * @callback GlslTransformSync
 * @param {String} filename The absolute path of the file you're transforming.
 * @param {String} src The shader source you'd like to transform.
 * @param {Object} opts The transform options.
 * @returns {String} transformed shader
 */

/**
 * @callback GlslTransformAsync
 * @param {String} filename The absolute path of the file you're transforming.
 * @param {String} src The shader source you'd like to transform.
 * @param {Object} opts The transform options.
 * @param {(err: Error, result: String) => any} [cb] callback with the transformed shader
 */

/**
 * @typedef {GlslTransformSync|GlslTransformAsync} GlslTransform
 */

/**
 * @callback TransformRequireSync
 * @param {String|GlslTransform} transform
 * @param {Object} opts
 * @returns {GlslTransform}
 */

/**
 * @callback TransformRequireAsync
 * @param {String|GlslTransform} transform
 * @param {Object} opts
 * @param {(err: Error, transform: GlslTransform) => any} [cb]
 */

/**
 * @typedef {TransformRequireSync|TransformRequireAsync} TransformRequire
 */

/**
 * @typedef {Object} TransformDefinition
 * @prop {string|GlslTransform} tr
 * @prop {string} name
 * @prop {any} opts
 */

/**
 * @typedef {Object} TransformResolved
 * @prop {GlslTransform} tr
 * @prop {string} name
 * @prop {any} opts
 */

/**
 * @typedef {Object} DepperOptions
 * @prop {Boolean} [async] Defines the mechanism flow resolution.
 * @prop {String} [cwd] The root directory of your shader. Defaults to process.cwd().
 * @prop {Function} [readFile] pass in a custom function reading files.
 * @prop {GlslResolve} [resolve] pass in a custom function for resolving require calls. It has the same signature as glsl-resolve.
 * @prop {Object<string, string>} [files] a filename/source object mapping of files to prepopulate the file cache with. Useful for overriding.
 * @prop {TransformRequireAsync|TransformRequireSync} [transformRequire] pass in a custom function for resolving non function transforms.
 */

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * note: this is an interface to be extended with a top class
 *
 * @class
 * @param {DepperOptions} [opts] options
 */
function Depper(opts) {
  if (!(this instanceof Depper)) return new Depper(opts)
  // @ts-ignore
  Emitter.call(this)

  opts = opts || {}

  this._inlineSource = ''
  this._inlineName = genInlineName()
  this._async      = opts.async || false
  this._i          = 0
  this._deps       = []

  this._cache      = {}
  this._trCache    = {}
  this._fileCache  = parseFiles(Object.assign({}, opts.files) || {})
  this._cwd        = opts.cwd || process.cwd()

  /** @type {TransformDefinition[]} */
  this._transforms = []
  /** @type {TransformDefinition[]} */
  this._globalTransforms = []

  if (typeof this._cwd !== 'string') {
    throw new Error('glslify-deps: cwd must be a string path')
  }

  if (!opts.readFile) {
    throw new Error('glslify-deps: readFile must be defined')
  }

  this._readFile = cacheWrap(opts.readFile, this._fileCache)

  if (!opts.resolve) {
    throw new Error('glslify-deps: resolve must be defined')
  }

  this.resolve = opts.resolve;

  if (!opts.transformRequire) {
    throw new Error('glslify-deps: transformRequire must be defined')
  }

  this.transformRequire = opts.transformRequire

  // @ts-ignore
  this._transformRequireAsync = !!opts.transformRequire.sync

  if (!this._async && this._transformRequireAsync) {
    throw new Error('glslify-deps: transformRequire async detected \
    \nwhen sync context, please ensure your resolver is even with the context')
  }
}

Depper.prototype.inline = function(source, basedir, done) {
  var inlineFile = path.resolve(basedir || this._cwd, this._inlineName)
  this._inlineSource = source
  return this.add(inlineFile, done)
}

/**
 * Internal method to add dependencies
 * @param {object} extra
 */
Depper.prototype._addDep = function(file, extra) {
  var dep = Object.assign({
    id: this._i++
  , file: file
  , deps: {}
  , source: null
  , entry: this._i === 1
  }, extra)

  this._deps.push(dep)

  return dep;
}

/**
 * Add method dummy interface
 */
Depper.prototype.add = function(filename, cb) {

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
 * @param {String|GlslTransform} transform
 * @param {Object} [opts]
 * @param {Boolean} [opts.global] adds transform to global scope
 * @param {Boolean} [opts.post]
 */
Depper.prototype.transform = function(transform, opts) {
  var name = typeof transform === 'string' ? transform : null
  var list = opts && opts.global
    ? this._globalTransforms
    : this._transforms

  // post transforms are ignored by glslify-deps, to be handled
  // by glslify after the file has been bundled.
  if (opts && opts.post) return this


  list.push({ tr: transform, opts: opts, name: name })

  return this
}

/**
 * Resolves a transform.
 * Works for both contexts async and sync
 * Functions are retained as-is.
 * Strings are resolved using the transformRequire option
 *
 *
 * @param {String|GlslTransform} transform
 * @param {(err: Error, transform?: GlslTransform) => any} [done] Applies if is defined
 * @return {Function}
 */
Depper.prototype.resolveTransform = function(transform, done) {
  var opts = { cwd: this._cwd }
  var self = this

  if (typeof transform === 'function') {
    if (done) done(null, transform)
    return transform
  }

  function selectTransform(tr) {
    if (self._async) return tr;
    if (!tr || typeof tr.sync !== 'function') {
      var err = new Error('transform ' + transform + ' does not provide a'
      + ' synchronous interface')
      if (done) {
        done(err)
        return null
      } else {
        throw err
      }
    }
    return tr.sync
  }

  if (this._transformRequireAsync) {
    this.transformRequire(transform, opts, function(err, resolved) {
      if (err) return done(err)
      return done(null, selectTransform(resolved))
    });
  } else {
    var tr = selectTransform(this.transformRequire(transform, opts))
    if (tr && done) done(null, tr)
    return tr
  }
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
 * @param {TransformResolved[]} transforms The transforms you'd like to apply.
 * @param {(err: Error, result?: string) => any} [done] Applies when async true
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
 * @param {(err: Error, transforms?: GlslTransform[]) => any} [done] Applies when async true
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

  function register(transforms, cb) {
    var result = trLocal
      .concat(transforms)
      .concat(self._globalTransforms)
      // map acts as synchronous if the iterator is always in
      // the main thread so is compatible with resolveTransform
      map(result, 1, function(tr, next) {
        self.resolveTransform(tr.tr, next)
      }, (err, resolved) => {
        if (err) {
          if(cb) return cb(err)
          throw err
        }
        result.forEach((tr, idx) => {
          tr.tr = resolved[idx]
        })
        if(cb) cb(null, result)
      })

    return trCache[fileDir] = result
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

        register(transforms, done)
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

inherits(Depper, Emitter)
module.exports = Depper

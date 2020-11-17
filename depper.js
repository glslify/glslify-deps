// @ts-check
/** @typedef {import('glsl-resolve')} GlslResolve */
var Emitter  = require('events/')
var inherits = require('inherits')
var map      = require('map-limit')

var {
  genInlineName,
  cacheWrap,
  parseFiles,
  getImportName,
  extractPreprocessors,
  asyncify,
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
  this._fileCache  = parseFiles(Object.assign({}, opts.files) || {})

  /** @type {TransformDefinition[]} */
  this._transforms = []
  /** @type {TransformDefinition[]} */
  this._globalTransforms = []

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

Depper.prototype.inline = function(source, filename, done) {
  this._inlineSource = source
  return this.add(filename || this._inlineName, done)
}

/**
 * Adds a shader file to the graph, including its dependencies
 * which are resolved in this step. Transforms are also applied
 * in the process too, as they may potentially add or remove dependent
 * modules.
 *
 * @param {String} filename The absolute path of this file.
 * @param {Object} [opts] The options will be pased to _resolveImports function.
 * @param {(err: Error, deps?: object[]) => any} [done]
 *
 * If async is defined then `done` callback will be called when the entire graph has been
 * resolved, and will include an array of dependencies discovered
 * so far as its second argument.
 *
 * If sync returns an array of dependencies discovered so far as its second argument.
 */
Depper.prototype.add = function(filename, opts, done) {
  if (typeof opts === 'function') {
    done = opts
    opts = {}
  }

  var self    = this
  var exports = []
  var imports = []
  var dep = this._addDep(filename)
  var resolveOpts = Object.assign({
    deps: dep.deps,
  }, opts)

  var process = asyncify(
    function(_, next) {return self.readFile(filename, next) },
    function(_, next) {return self.getTransformsForFile(filename, next) },
    function(result, next) {
      // @ts-ignore
      self.emit('file', filename)
      return self.applyTransforms(filename, result[0], result[1], next)
    },
    function(result, next) {
      extractPreprocessors(dep.source = result[2], imports, exports)
      return self._resolveImports(imports, resolveOpts, next)
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
 * Dummy internal function for resolve transforms for a file
 * @param {String} filename The absolute path of the file in question.
 * @param {(err: Error, transforms?: GlslTransform[]) => any} [done] Applies when async true
 * @returns {GlslTransform[]} List of transform for a file
 */
Depper.prototype.getTransformsForFile = function(filename, done) {
  if(done) {
    done(null, [])
  }
  console.warn('glslify-deps: depper.getTransformsForFile() not yet implemented')
  return []
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
 * @param {Object} [opts] The options will be pased to transformRequire function.
 * @param {(err: Error, transform?: GlslTransform) => any} [done] Applies if is defined
 * @return {Function}
 */
Depper.prototype.resolveTransform = function(transform, opts, done) {
  if (typeof opts === 'function') {
    done = opts
    opts = {}
  }

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
 * Internal method to add dependencies
 * @param {object} [extra]
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
 * Internal method to register transforms
 * @param {TransformDefinition[]} transforms
 * @param {(err: Error, resolved?: TransformResolved[]) => any} cb
 * @returns {TransformResolved[]}
 */
Depper.prototype._register = function(transforms, cb) {
  var self = this;
  /** @type {TransformResolved[]} */
  // @ts-ignore
  var result = transforms
      .concat(this._globalTransforms)
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

  return result
}

/**
 * Internal async method to retrieve dependencies
 * resolving imports using the internal cache
 *
 * @param {string[]} imports
 * @param {object} [opts] The options will be pased to resolve function.
 * @param {object} [opts.deps] Existing dependencies
 * @param {number} [opts.parallel=10] Parallel threads when async
 * @param {(err: Error) => any} [done]
 * @return {object} Resolved dependencies
 */
Depper.prototype._resolveImports = function(imports, opts, done) {
  if (typeof opts === 'function') {
    done = opts
    opts = {}
  }
  var self = this
  var deps = opts && opts.deps || {}
  var parallel = opts && opts.parallel || 10

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

Depper.prototype.readFile = function(filename, done) {
  if (filename !== this._inlineName)
    return this._readFile(filename, done)

  if(this._async) {
    return done(null, this._inlineSource)
  }
  return this._inlineSource
}

inherits(Depper, Emitter)
module.exports = Depper

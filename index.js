var tokenize = require('glsl-tokenizer/string')
var findup   = require('@choojs/findup')
var fs       = require('graceful-fs')
var map      = require('map-limit')
var inherits = require('inherits')
var path     = require('path')
var Depper = require('./depper')
var {
  glslifyPreprocessor,
  glslifyExport,
  glslifyImport,
} = require('./common.js')

module.exports = DepperAsync

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 *
 * @class
 * @param {String} cwd The root directory of your shader. Defaults to process.cwd()
 */
inherits(DepperAsync, Depper)
function DepperAsync(opts) {
  if (!(this instanceof DepperAsync)) return new DepperAsync(opts)
  Depper.call(this, opts, true);
}

/**
 * Adds a shader file to the graph, including its dependencies
 * which are resolved in this step. Transforms are also applied
 * in the process too, as they may potentially add or remove dependent
 * modules.
 *
 * @param {String} filename The absolute path of this file.
 * @param {String} src The shader source for this file.
 * @param {Function} done(err, deps)
 *
 * The `done` callback will be called when the entire graph has been
 * resolved, and will include an array of dependencies discovered
 * so far as its second argument.
 */
DepperAsync.prototype.add = function(filename, done) {
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
  this.readFile(filename, function(err, src) {
    if (err) return done(err)

    self.getTransformsForFile(filename, function(err, trs) {
      if (err) return done(err)

      self.emit('file', filename)
      self.applyTransforms(filename, src, trs, function(err, src) {
        if (err) return done(err)

        dep.source = src
        extractPreprocessors()
        resolveImports(function(err) {
          setTimeout(function() {
            done && done(err, !err && self._deps)
          })
        })
      })
    })
  })

  return dep

  function extractPreprocessors() {
    var tokens = tokenize(dep.source)

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]
      if (token.type !== 'preprocessor') continue

      var data = token.data
      if (!glslifyPreprocessor(data)) continue

      var exp = glslifyExport(data)
      var imp = glslifyImport(data)
      if (exp) exports.push(exp[1])
      if (imp) imports.push(imp[2])
    }
  }

  function resolveImports(resolved) {
    map(imports, 10, function(imp, next) {
      var importName = imp.split(/\s*,\s*/).shift()

      importName = importName.trim()
      importName = importName.replace(/^'|'$/g, '')
      importName = importName.replace(/^"|"$/g, '')

      self.resolve(importName, { basedir: basedir }, function(err, resolved) {
        if (err) return next(err)

        if (cache[resolved]) {
          dep.deps[importName] = cache[resolved].id
          return next()
        }

        cache[resolved] = self.add(resolved, function(err) {
          if (err) return next(err)
          dep.deps[importName] = cache[resolved].id
          next()
        })
      })
    }, resolved)
  }
}

DepperAsync.prototype.readFile = function(filename, done) {
  if (path.basename(filename) !== this._inlineName)
    return this._readFile(filename, done)

  return done(null, this._inlineSource)
}

/**
 * Determines which transforms to use for a particular file.
 * The rules here are the same you see in browserify:
 *
 * - your shader files will have your specified transforms applied to them
 * - shader files in node_modules do not get local transforms
 * - all files will apply transforms specified in `glslify.transform` in your
 *   `package.json` file, albeit after any transforms you specified using
 *   `depperAsync.transform`.
 *
 * @param {String} filename The absolute path of the file in question.
 */
DepperAsync.prototype.getTransformsForFile = function(filename, done) {
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

  if (trCache[fileDir]) {
    return done(null, trCache[fileDir])
  }

  findup(fileDir, 'package.json', function(err, found) {
    var notFound = err && err.message === 'not found'
    if (notFound) return register([])
    if (err) return done(err)

    var pkg = path.join(found, 'package.json')

    self.readFile(pkg, function(err, pkgjson) {
      if (err) return done(err)

      try {
        pkgjson = JSON.parse(pkgjson)
      } catch(e) { return done(e) }

      var transforms = (
           pkgjson['glslify']
        && pkgjson['glslify']['transform']
        || []
      )

      transforms = transforms.map(function(key) {
        var transform = Array.isArray(key)
          ? key
          : [key, {}]

        var key = transform[0]
        var opt = transform[1]

        if (opt) {
          delete opt.global
          delete opt.post
        }

        return { tr: key, opts: opt, name: key }
      }).map(function(tr) {
        tr.tr = self.resolveTransform(tr.tr)
        return tr
      })

      register(transforms)
    })
  })

  function register(transforms) {
    done(null, trCache[fileDir] = trLocal
      .concat(transforms)
      .concat(self._globalTransforms))
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
 * @param {Array} transforms The transforms you'd like to apply.
 * @param {Function} done(err, transformed)
 */
DepperAsync.prototype.applyTransforms = function(filename, src, transforms, done) {
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
}

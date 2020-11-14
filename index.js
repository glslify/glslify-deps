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

  function resolveImports(done) {
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
    }, done)
  }
}

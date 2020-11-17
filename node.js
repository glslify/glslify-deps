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
  getTransformsFromPkg,
  mix,
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
 * @constructor
 * @param {string} cwd
 *//**
 * @constructor
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
 * @override
 * @param {String} filename The absolute path of this file.
 * @param {(err: Error, deps?: object[]) => any} [done]
 */
NodeDepper.prototype.add = function(filename, done) {
  var resolved = path.resolve(filename);
  return Depper.prototype.add.call(this, resolved, {
    basedir: path.dirname(resolved)
  }, done)
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
 * @returns {GlslTransform[]} List of transform for a file
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

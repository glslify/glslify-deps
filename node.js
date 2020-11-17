/** @typedef {import('./depper').DepperOptions} DepperOptions */
var Depper   = require('./depper')
var path     = require('path')
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
 * @param {String} [opts.cwd] The root directory of your shader. Defaults to process.cwd().
 */
function NodeDepper(opts) {
  if (!(this instanceof NodeDepper)) return new NodeDepper(opts)
  opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
  opts.resolve = opts.resolve || mix(glslResolve.sync, glslResolve)
  // keeps the original behaviour of transform resolution but overridable
  opts.transformRequire = opts.transformRequire || transformRequire.sync
  opts.readFile = opts.readFile || createDefaultRead()
  Depper.call(this, opts)

  this._cwd        = opts.cwd || process.cwd()
  this._trCache    = {}

  if (typeof this._cwd !== 'string') {
    throw new Error('glslify-deps: cwd must be a string path')
  }
}

/**
 * @override
 * @param {*} source
 * @param {*} basedir
 * @param {*} done
 */
NodeDepper.prototype.inline = function(source, basedir, done) {
  var inlineFile = path.resolve(basedir || this._cwd, this._inlineName)
  return Depper.prototype.inline.call(this, source, inlineFile, done);
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
 * @override
 * @param {String|GlslTransform} transform
 * @param {(err: Error, transform?: GlslTransform) => any} [done] Applies if is defined
 * @return {Function}
 */
NodeDepper.prototype.resolveTransform = function(transform, done) {
  return Depper.prototype.resolveTransform.call(this, transform, {
    cwd: this._cwd
  }, done)
}

/**
 * @override
 * @param {*} filename
 * @param {*} done
 */
NodeDepper.prototype.readFile = function(filename, done) {
  if (path.basename(filename) !== this._inlineName)
    return this._readFile(filename, done)

  if(this._async) {
    return done(null, this._inlineSource)
  }
  return this._inlineSource
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

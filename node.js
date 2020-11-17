// @ts-check
/** @typedef {import('./depper').DepperOptions} DepperOptions */
/** @typedef {import('./depper').TransformResolved} TransformResolved */
/** @typedef {import('./depper').GlslTransform} GlslTransform */
/** @typedef {import('./depper').DepperGraph} DepperGraph */

const Depper = require('./depper')
const path = require('path')
const fs = require('graceful-fs')
const findup = require('@choojs/findup')
const glslResolve = require('glsl-resolve')
const transformRequire = require('./transform-require')

const {
  getTransformsFromPkg,
  mix,
} = require('./utils');

/**
 * Creates a mixed sync/async file reader
 * @returns {(filename: string, done?: (err: Error, content: string) => any) => string?}
 */
const createDefaultRead = () => {
  /**
   * @param {string} filename
   * @param {(err: Error, content: string) => any} done
   */
  const defaultReadAsync = (filename, done) => {
    fs.readFile(filename, 'utf8', done)
  }

  /**
   * @param {string} filename
   * @returns {string}
   */
  const defaultRead = (filename) => fs.readFileSync(filename, 'utf8')

  // @ts-ignore
  return mix(defaultRead, defaultReadAsync)
}

/**
 * @typedef {Object} NodeDepperOptions
 * @prop {String} [cwd] The root directory of your shader. Defaults to process.cwd().
 */

/**
 * Creates a new instance of glslify-deps. Generally, you'll
 * want to use one instance per bundle.
 * Based in node module resolution
 */
class NodeDepper extends Depper {
  /**
   * @param {DepperOptions & NodeDepperOptions} [opts]
   */
  constructor(opts) {
    opts = (typeof opts === 'string' ? { cwd: opts } : opts) || {}
    // @ts-ignore
    opts.resolve = opts.resolve || mix(glslResolve.sync, glslResolve)
    // keeps the original behaviour of transform resolution but overridable
    opts.transformRequire = opts.transformRequire || transformRequire.sync
    opts.readFile = opts.readFile || createDefaultRead()
    super(opts)

    this._cwd        = opts.cwd || process.cwd()
    this._trCache    = {}

    if (typeof this._cwd !== 'string') {
      throw new Error('glslify-deps: cwd must be a string path')
    }
  }

  /**
   * Adds a new inline file to the dependency graph, where source is the GLSL source
   * to include and basedir is the directory to pretend it's being created in.
   * A basedir is required to properly resolve requires and transforms, and defaults to process.cwd()
   * @param {string} source
   * @param {string} basedir
   * @param {(err: Error, deps: DepperGraph[]) => any} [done]
   * @returns {DepperGraph[]}
   */
  inline(source, basedir, done) {
    const inlineFile = path.resolve(basedir || this._cwd, this._inlineName)
    return super.inline(source, inlineFile, done)
  }

  /**
   * @override
   * @param {String} filename The absolute path of this file.
   * @param {(err: Error, deps?: object[]) => any} [done]
   */
  add(filename, done) {
    const resolved = path.resolve(filename);
    return super.add(resolved, {
      basedir: path.dirname(resolved)
    }, done)
  }

  /**
   * @override
   * @param {String|GlslTransform} transform
   * @param {(err: Error, transform?: GlslTransform) => any} [done] Applies if is defined
   * @return {Function}
   */
  resolveTransform(transform, done) {
    return super.resolveTransform(transform, {
      cwd: this._cwd
    }, done)
  }

  /**
   * @override
   * @param {*} filename
   * @param {*} [done]
   */
  readFile(filename, done) {
    if (path.basename(filename) !== this._inlineName)
      return this._readFile(filename, done)

    if(this._async) {
      return done(null, this._inlineSource)
    }
    return this._inlineSource
  }


  /**
   * @override
   * @param {String} filename The absolute path of the file in question.
   * @param {(err: Error, transforms?: TransformResolved[]) => any} [done] Applies when async true
   * @returns {TransformResolved[]} List of transform for a file
   */
  getTransformsForFile(filename, done) {
    const self  = this
    const entry = this._deps[0]

    if (!entry) return done(new Error(
      'getTransformsForFile may only be called after adding your entry file'
    ))

    const entryDir     = path.dirname(path.resolve(entry.file))
    const fileDir      = path.dirname(path.resolve(filename))
    const relative     = path.relative(entryDir, fileDir).split(path.sep)
    const node_modules = relative.indexOf('node_modules') !== -1
    const trLocal      = node_modules ? [] : this._transforms
    const trCache      = this._trCache
    const pkgName      = 'package.json'

    if (trCache[fileDir]) {
      if (this._async) {
        return done(null, trCache[fileDir])
      } else {
        return trCache[fileDir]
      }
    }

    if (this._async) {
      findup(fileDir, pkgName, (err, found) => {
        const notFound = err && err.message === 'not found'
        if (notFound) return self._register([], done)
        if (err) return done(err)

        const pkg = path.join(found, pkgName)

        self.readFile(pkg, (err, pkgJson) => {
          if (err) return done(err)
          let transforms;
          try {
            transforms = getTransformsFromPkg(pkgJson)
          } catch(e) { return done(e) }

          trCache[fileDir] = self._register(trLocal.concat(transforms), done)
        })
      })
    } else {
      let found
      try {
        found = findup.sync(fileDir, pkgName)
      } catch (err) {
        const notFound = err.message === 'not found'
        if (notFound) return self._register([])
        else throw err
      }

      const pkg = path.join(found, pkgName)
      const transforms = getTransformsFromPkg(self.readFile(pkg))

      return trCache[fileDir] = self._register(trLocal.concat(transforms))
    }
  }
}

module.exports = NodeDepper

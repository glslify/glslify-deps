// @ts-check

const tokenize = require('glsl-tokenizer/string')
const path = require('path')

const glslifyPreprocessor = (data) => {
  return /#pragma glslify:/.test(data)
}

const glslifyExport = (data) => {
  return /#pragma glslify:\s*export\(([^\)]+)\)/.exec(data)
}

const glslifyImport = (data) => {
  return /#pragma glslify:\s*([^=\s]+)\s*=\s*require\(([^\)]+)\)/.exec(data)
}

const genInlineName = () => {
  return '__INLINE__' + Math.random()
}

/**
 * Gets glslify transform from given package.json
 *
 * @param {object|string} pkgJson package.json string data or json
 * @returns {({tr: string, name: string, opts: object})[]}
 */
const getTransformsFromPkg = (pkgJson) => {
  if (typeof pkgJson === 'string') {
    pkgJson = JSON.parse(pkgJson)
  }

  const transforms = (
    pkgJson.glslify &&
  pkgJson.glslify.transform ||
  []
  )

  return transforms.map((tr) => {
    const transform = Array.isArray(tr)
      ? tr
      : [tr, {}]

    const key = transform[0]
    const opt = transform[1]

    if (opt) {
      delete opt.global
      delete opt.post
    }

    return { tr: key, opts: opt, name: key }
  })
}

/**
 * Extracts preprocessors copying the imports and exports
 * into respective parameters
 * @param {string} source
 * @param {string[]} imports
 * @param {string[]} exports
 */
const extractPreprocessors = (source, imports, exports) => {
  const tokens = tokenize(source)

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type !== 'preprocessor') continue

    const data = token.data
    if (!glslifyPreprocessor(data)) continue

    const exp = glslifyExport(data)
    const imp = glslifyImport(data)
    if (exp) exports.push(exp[1])
    if (imp) imports.push(imp[2])
  }
}

const getImportName = (imp) => {
  return imp
    .split(/\s*,\s*/)
    .shift()
    .trim()
    .replace(/^'|'$/g, '')
    .replace(/^"|"$/g, '')
}

/** Fast apply */
const apply = (fn, args) => {
  switch (args.length) {
    case 1:
      return fn(args[0])
    case 2:
      return fn(args[0], args[1])
    case 3:
      return fn(args[0], args[1], args[2])
    case 4:
      return fn(args[0], args[1], args[2], args[3])
    default:
      return fn.apply(null, args)
  }
}
/**
 * Takes an sync and async functions and return a function which detects if the last argument
 * is a callback in order to select which flow to use
 * @param {function} sync
 * @param {function} async
 * @returns {(...args, done) => any}
 */
const mix = (sync, async) => {
  const mixed = (...args) => {
    if (typeof args[args.length - 1] === 'function') {
      if (!async) {
        throw Error('There\'s no async function available')
      }
      apply(async, args)
    }
    if (!sync) {
      throw Error('There\'s no sync function available')
    }
    return apply(sync, args)
  }

  mixed.sync = sync
  mixed.async = async

  return mixed
}

/**
 * Allows reuse sync/async logics detecting if done is defined to select which strategy to use.
 * Arguments must be functions, if sync is detected then takes the returned value,
 * otherwise when async next will be defined and will take the result from there
 *
 * @param {...(prevState: any[], next?: (err?: Error, result?: any) => void) => void} fns
 * @returns {((initialState?: any[], done?: (err: Error, state?: any[]) => any) => void[])&((done?: (err: Error, state?: any[]) => any) => any[])}
 * @example
 *
 * const process = asyncify(
 *   ([foo], next) => next ? next(null, 'bar') : 'bar',
 *   ([foo, bar], next) => next ? next(null, foo + bar) : foo + bar
 * )
 *
 * // sync
 * const state = process(['foo'])
 * console.log(state) // ['foo', 'bar', 'foobar']
 *
 * // async
 * process(['bar'], (err, result) => console.log(result)) // ['foo', 'bar', 'foobar']
 *
 */
const asyncify = (...fns) => {
  return (initialState, done) => {
    if (typeof initialState === 'function') {
      done = initialState
      initialState = []
    }

    const state = initialState || []
    let cursor = state.length
    let i = 0

    if (!Array.isArray(state)) {
      throw new Error('asyncify: initialState must be an array')
    }

    if (!fns.length) {
      throw new Error('asyncify: no functions detected')
    }

    if (typeof state[state.length - 1] === 'function') {
      done = state.pop()
      cursor = state.length
    }

    const error = () => {
      return new Error('asyncify: arguments must be functions')
    }

    if (!done) {
      for (; i < fns.length; i++) {
        if (typeof fns[i] !== 'function') {
          throw error()
        }
        state[cursor + i] = fns[i](state)
      }
    } else {
      /**
       *
       * @param {Error} [err]
       * @param {any} [result]
       */
      const next = (err, result) => {
        if (err) {
          done(err)
        } else {
          state[cursor + i++] = result
          if (i < fns.length) {
            if (typeof fns[i] !== 'function') {
              done(error())
            } else {
              fns[i](state, next)
            }
          } else {
            done(null, state[state.length - 1])
          }
        }
      }

      fns[i](state, next)
    }

    return state
  }
}

const cacheWrap = (read, cache) => {
  const readFromCache = (filename) => {
    if (!cache[filename]) {
      cache[filename] = read(filename)
    }
    return cache[filename]
  }

  const readFromCacheAsync = (filename, done) => {
    if (!cache[filename]) {
      return read(filename, (err, content) => {
        if (err) done(err)
        done(err, cache[filename] = content)
      })
    }
    return process.nextTick(() => {
      done(null, cache[filename])
    })
  }

  return mix(readFromCache, readFromCacheAsync)
}

const parseFiles = (files) => {
  // resolve all files such that they match
  // all of the paths glslify handles, which are otherwise
  // absolute
  return Object.keys(files).reduce((newCache, file) => {
    newCache[path.resolve(file)] = files[file]
    return newCache
  }, {})
}

module.exports = {
  getTransformsFromPkg,
  getImportName,
  extractPreprocessors,
  genInlineName,
  cacheWrap,
  mix,
  parseFiles,
  asyncify
}

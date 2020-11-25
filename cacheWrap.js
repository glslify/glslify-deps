var path = require('path')

function cacheWrap(read, cache, async) {
  // resolve all cached files such that they match
  // all of the paths glslify handles, which are otherwise
  // absolute
  cache = Object.keys(cache).reduce(function(newCache, file) {
    newCache[path.resolve(file)] = cache[file]
    return newCache
  }, {})

  return function readFromCache(filename, done) {
    if (!cache[filename]) {
      if (async) {
        return read(filename, done)
      }
      cache[filename] = read(filename)
    }

    if (async) {
      return process.nextTick(function() {
        done(null, cache[filename])
      })
    }
    return cache[filename]
  }
}

module.exports = cacheWrap;

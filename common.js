function glslifyPreprocessor(data) {
    return /#pragma glslify:/.test(data)
  }

function glslifyExport(data) {
  return /#pragma glslify:\s*export\(([^\)]+)\)/.exec(data)
}

function glslifyImport(data) {
  return /#pragma glslify:\s*([^=\s]+)\s*=\s*require\(([^\)]+)\)/.exec(data)
}

function genInlineName() {
  return '__INLINE__' + Math.random()
}

module.exports = {
  glslifyPreprocessor,
  glslifyExport,
  glslifyImport,
  genInlineName,
};

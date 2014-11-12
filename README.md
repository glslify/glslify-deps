# glslify-deps

**WORK IN PROGRESS. Currently useless, more to come soon.**

Walk the dependency graph of a [glslify](http://github.com/stackgl/glslify)
shader.

Splitting this out into a separate package makes the final bundling process
a lot simpler internally, but also gives you plenty of flexibility to muck
with the shader before it hits the bundler.

`glslify-deps` is responsible for resolving your shader's dependencies and
applying their transforms before the actual source modification occurs. You may
notice some parallels here with [browserify](http://browserify.org)'s
[module-deps](http://github.com/substack/module-deps) package.

## Example Output

``` json
[
  {
    "id": 0,
    "deps": { "glsl-random": 1 },
    "file": "index.glsl",
    "source": "precision mediump float;\n#pragma glslify: random = require(glsl-random)\n",
    "entry": true
  },
  {
    "id": 1,
    "deps": {},
    "file": "node_modules/glsl-random/index.glsl",
    "source": "highp float random(vec2 co)\n{\n    highp float a = 12.9898;\n    highp float b = 78.233;\n    highp float c = 43758.5453;\n    highp float dt= dot(co.xy ,vec2(a,b));\n    highp float sn= mod(dt,3.14);\n    return fract(sin(sn) * c);\n}\n\n#pragma glslify: export(random)",
    "entry": false
  }
]
```

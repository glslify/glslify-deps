#pragma glslify: fake = require( 'glsl-fake' )

vec3 hello() {
  return #FFFFFF;
}

#pragma glslify: export(hello)

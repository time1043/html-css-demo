// Balatro swirl background — tutorial steps 01-07: pixelate, twist, wobble, spin
// (this file mirrors the tutorial's own swirl.frag)

precision highp float;

uniform vec2 u_size;   // Canvas size in pixels
uniform float u_freq;  // Color band frequency
uniform float u_swirl; // Twist intensity
uniform float u_time;  // Elapsed seconds

// The four colors on the band, measured from the flat plateaus of the tutorial's canvas
const vec3 CYAN   = vec3(0.094, 0.765, 0.776);
const vec3 BLUE   = vec3(0.000, 0.443, 0.741);
const vec3 PINK   = vec3(1.000, 0.176, 0.565);
const vec3 ORANGE = vec3(1.000, 0.710, 0.188);

// Phase shift that lines the bands up with the tutorial (pure orange around x = 0.32)
const float BAND_PHASE = 0.5;

// Half width of the blend between neighboring colors; the rest of each
// segment stays a flat plateau (this gives the bands their crisp edges)
const float BAND_SOFT = 0.25;

// Wobble: repeatedly nudge p by its own position — this bends the swirl
// arms into the wavy Balatro look
const float WOBBLE_AMP = 0.6; // Strength of each nudge
const int WOBBLE_ITER = 5;    // How many times the nudge is applied

// Pixelate: every 8x8 render-pixel block shares one address (the pixel-art look)
const float PIXEL_SIZE = 8.0;

// Rotate point v around the origin by a radians (counterclockwise)
vec2 rotate(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, s, -s, c) * v;
}

// Take the x coordinate and look up a color on the band:
// four color segments joined head-to-tail into a loop
vec3 paint(float x) {
  float t = fract(x * u_freq + BAND_PHASE) * 4.0;
  vec3 col = mix(CYAN,   BLUE,   smoothstep(0.5 - BAND_SOFT, 0.5 + BAND_SOFT, t));
  col = mix(col, PINK,   smoothstep(1.5 - BAND_SOFT, 1.5 + BAND_SOFT, t));
  col = mix(col, ORANGE, smoothstep(2.5 - BAND_SOFT, 2.5 + BAND_SOFT, t));
  col = mix(col, CYAN,   smoothstep(3.5 - BAND_SOFT, 3.5 + BAND_SOFT, t));
  return col;
}

void main() {
  // 01: Pixelate — snap the pixel onto an 8x8 block corner so neighboring
  // pixels share one address ("nearby points squeeze onto the same address")
  vec2 pos = floor(gl_FragCoord.xy / PIXEL_SIZE) * PIXEL_SIZE;

  // 02: Move the origin to the center of the screen; screen height counts as 1
  vec2 p = (pos - 0.5 * u_size) / u_size.y;

  // 03: Distance from the center
  float r = length(p);

  // 04: Rotate around the center: the farther out, the more it turns,
  // and the whole pattern keeps spinning as time passes
  p = rotate(p, r * u_swirl - u_time);

  // 05-06: Wobble — "look at where you are, then push yourself by that position".
  // p.yx feeds (y, x) back into sin, so x gets pushed by y and y by x;
  // applying it repeatedly bends the swirl arms into wavy bands
  for (int i = 0; i < WOBBLE_ITER; i++) {
    p += WOBBLE_AMP * sin(p.yx + u_time);
  }

  // 07: Take the x coordinate and look up the color on the band
  vec3 color = paint(p.x);

  gl_FragColor = vec4(color, 1.0);
}

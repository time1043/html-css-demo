// ================== Tunable parameters (tweak these while polishing) ==================
const CONFIG = {
  swirl: 4.0, // Twist intensity: the farther from the center, the more it turns (the 4.0 from tutorial step 03)
  spin: 0.25, // Global rotation speed in rad/s; the tutorial hardcoded 1.0 (one full turn every ~6.3s). Lower = slower
};

// Vertex shader: one big triangle covering the whole screen
const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Fragment shader: Balatro swirl — pixelate, twist, domain warp, and the
// game's blue/red/dark ring palette
const FRAG = /* glsl */ `
precision highp float;

uniform vec2 u_size;   // Canvas size in pixels
uniform float u_swirl; // Twist intensity
uniform float u_spin;  // Global rotation speed in rad/s
uniform float u_time;  // Elapsed seconds

// The game's color ring, looked up by distance from the center:
// a blue core in the middle, a red ring around it, dark edges beyond
const vec3 BLUE_CENTER = vec3(0.25, 0.56, 0.85); // soft azure of the middle blob
const vec3 RED_RING    = vec3(0.80, 0.33, 0.28); // coral red of the surrounding ring
const vec3 DARK_EDGE   = vec3(0.12, 0.14, 0.19); // dark navy toward the outside

// Where the color transitions sit, in the same units as the warped distance
// (p is scaled up by 30, so the screen spans about 0..15 from center to edge)
const float BLUE_RED_MID = 5.5;  // halfway between the blue core and the red ring
const float RED_DARK_MID = 11.5; // halfway between the red ring and the dark edge
const float RING_SOFT = 2.5;     // half width of each transition (higher = softer)

// Wobble: repeatedly nudge p by its own position — this bends the swirl
// arms into the wavy Balatro look
const float WOBBLE_AMP = 0.6; // Strength of each nudge
const int WOBBLE_ITER = 5;    // How many times the nudge is applied

// Pixelate: every 8x8 render-pixel block shares one address (the pixel-art look)
const float PIXEL_SIZE = 2.0;

// Rotate point v around the origin by a radians (counterclockwise)
vec2 rotate(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, s, -s, c) * v;
}

// Direction vector from accumulated coordinate (dir)
vec2 dir(vec2 acc) {
  return vec2(
    cos(5.1123314 + 0.353 * acc.y + u_time * 0.131121),
    sin(acc.x - 0.113 * u_time)
  );
}

// Diagonal twist: cos along (x + y) and sin along (0.711 * x - y)
vec2 diagonalTwist(vec2 p) {
  return vec2(cos(p.x + p.y) - sin(p.x * 0.711 - p.y));
}

// The game's ring: blue in the middle, a ring of red around it, dark outside
vec3 gameRing(float dist) {
  vec3 col = BLUE_CENTER;
  col = mix(col, RED_RING,  smoothstep(BLUE_RED_MID - RING_SOFT, BLUE_RED_MID + RING_SOFT, dist));
  col = mix(col, DARK_EDGE, smoothstep(RED_DARK_MID - RING_SOFT, RED_DARK_MID + RING_SOFT, dist));
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
  // and the whole pattern keeps spinning as time passes (u_spin scales the speed)
  p = rotate(p, r * u_swirl - u_time * u_spin);

  // 05: Scale up coordinates before deformation loop
  p = p * 30.0;

  // Accumulator initialized to (p.x + p.y)
  vec2 acc = vec2(p.x + p.y);

  // 06: Repeat 5 times
  for (int i = 0; i < WOBBLE_ITER; i++) {
    // 07: Accumulate non-linear displacement
    acc += vec2(sin(max(p.x, p.y))) + p;

    // 08: Push position along direction vector
    p += 0.5 * dir(acc);

    // 09: Diagonal twist
    p -= 1.0 * diagonalTwist(p);
  }

  // 10: The game's ring — look up the color by distance from the center:
  // blue in the middle, a ring of red around it, dark outside
  vec3 color = gameRing(length(p));

  gl_FragColor = vec4(color, 1.0);
}
`;

function init() {
  const canvas = document.getElementById("swirl");
  const gl =
    canvas.getContext("webgl", { antialias: false }) ||
    canvas.getContext("experimental-webgl");

  // Fall back to a static CSS gradient when WebGL is unavailable
  if (!gl) {
    document.body.classList.add("no-webgl");
    return;
  }

  // Compile a shader; log the info log on failure
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    document.body.classList.add("no-webgl");
    return;
  }
  gl.useProgram(program);

  // The fullscreen big triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uSize = gl.getUniformLocation(program, "u_size");
  const uSwirl = gl.getUniformLocation(program, "u_swirl");
  const uSpin = gl.getUniformLocation(program, "u_spin");
  const uTime = gl.getUniformLocation(program, "u_time");

  // Track the window size and render at the device pixel ratio (capped at 2 so high-DPI screens stay fast)
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  // Optional ?t=<seconds> pins the shader clock, useful for frame-by-frame comparisons
  const pinnedTime = parseFloat(new URLSearchParams(location.search).get("t"));
  const hasPinnedTime = Number.isFinite(pinnedTime);

  // Render loop: feed elapsed time into the shader so the swirl keeps spinning
  let elapsed = 0;
  let last = performance.now();
  function frame(now) {
    // Cap each step so the picture never jumps after a background tab
    elapsed += Math.min((now - last) / 1000, 0.1);
    last = now;

    resize();
    gl.uniform2f(uSize, canvas.width, canvas.height);
    gl.uniform1f(uTime, hasPinnedTime ? pinnedTime : elapsed);
    gl.uniform1f(uSwirl, CONFIG.swirl);
    gl.uniform1f(uSpin, CONFIG.spin);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init();

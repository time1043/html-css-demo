// ================== Tunable parameters (tweak these while polishing) ==================
const CONFIG = {
  swirl: 4.0, // Twist intensity: the farther from the center, the more it turns (the 4.0 from tutorial step 03)
  spin: 0.25, // Global rotation speed in rad/s; the tutorial hardcoded 1.0 (one full turn every ~6.3s). Lower = slower
};

// The game's ring palette as a 1D gradient (256 RGB stops), measured from the
// game's own radial palette bar: a blue core in the middle (dist 0), fading
// through a dark band, a red ring around it (dist ~10), and dark edges beyond
const PALETTE_LUT = new Uint8Array([
  9,171,250,11,168,251,8,167,250,1,167,250,1,167,250,1,167,251,2,167,250,6,163,249,
  7,162,249,2,162,249,2,162,247,1,160,244,4,159,242,3,158,240,3,157,237,5,157,235,
  7,156,235,8,154,233,4,153,232,7,152,230,9,151,228,9,149,224,8,148,222,10,147,221,
  8,146,219,8,146,218,8,144,217,11,144,215,11,143,214,12,142,213,10,141,210,13,140,207,
  15,139,204,13,138,201,14,137,200,12,136,198,14,134,196,12,134,196,13,133,193,16,132,191,
  17,131,189,18,131,187,20,130,183,18,125,176,22,124,173,24,122,172,27,120,169,26,118,166,
  28,117,164,27,115,161,29,113,157,29,111,153,31,109,148,32,107,144,34,106,141,38,105,139,
  39,103,136,37,100,132,36,98,130,38,96,127,41,96,124,42,93,119,42,90,114,42,88,110,
  44,88,107,44,86,103,45,83,98,47,82,94,48,80,92,50,78,89,50,74,84,51,72,81,
  54,70,78,56,70,76,59,70,73,61,69,71,64,70,71,69,71,73,71,70,73,77,72,74,
  82,73,75,84,74,76,88,74,76,93,75,77,98,76,78,103,76,79,104,76,78,106,77,79,
  112,79,78,118,79,79,122,80,79,126,80,78,129,82,81,133,82,81,137,82,80,137,83,81,
  141,84,81,145,84,81,151,86,84,155,88,85,159,87,85,160,86,85,162,87,84,167,88,85,
  171,90,85,175,91,85,177,91,84,181,92,85,185,93,85,189,94,86,194,94,87,197,94,88,
  200,95,90,204,97,90,207,97,91,210,98,92,213,97,93,218,98,92,220,99,92,222,100,93,
  225,99,93,230,101,94,233,102,95,236,103,93,239,102,94,242,105,96,246,105,96,247,105,96,
  248,104,96,248,104,96,247,105,96,244,106,95,240,104,94,237,103,93,235,101,95,234,101,95,
  232,100,94,228,99,93,223,99,91,219,97,90,217,98,91,215,97,90,211,98,91,206,97,91,
  201,96,90,197,95,90,194,96,88,191,95,87,188,93,84,185,93,84,183,93,84,179,91,84,
  175,91,85,171,90,86,167,89,85,164,88,85,161,87,82,155,86,81,151,87,83,145,85,80,
  144,85,81,141,84,80,136,81,78,132,82,79,129,82,80,128,82,81,125,81,79,121,79,79,
  117,78,80,111,79,78,108,78,77,105,77,76,101,77,76,95,75,74,91,74,76,87,74,75,
  85,74,75,80,72,74,76,70,73,71,70,73,67,69,71,64,69,70,61,68,71,58,68,71,
  53,66,68,55,67,70,55,67,70,55,67,71,55,67,71,55,67,71,55,67,71,54,67,70,
  54,67,70,55,67,70,55,67,70,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
  55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
  55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
  55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
  55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
  55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
  55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
  55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,55,67,69,
]);

// Vertex shader: one big triangle covering the whole screen
const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Fragment shader: Balatro swirl — pixelate, twist, domain warp, and the
// game's blue/red/dark ring palette (sampled from the 1D palette texture)
const FRAG = /* glsl */ `
precision highp float;

uniform vec2 u_size;        // Canvas size in pixels
uniform float u_swirl;      // Twist intensity
uniform float u_spin;       // Global rotation speed in rad/s
uniform float u_time;       // Elapsed seconds
uniform sampler2D u_palette; // 1D palette gradient: blue core -> dark -> red ring -> dark edges

// Wobble: repeatedly nudge p by its own position — this bends the swirl
// arms into the wavy Balatro look
const float WOBBLE_AMP = 0.6; // Strength of each nudge
const int WOBBLE_ITER = 5;    // How many times the nudge is applied

// Pixelate: every 8x8 render-pixel block shares one address (the pixel-art look)
const float PIXEL_SIZE = 2.0;

// The warped distance from the center that maps onto the far (dark) end of
// the palette gradient, fitted against the game's own render
const float PALETTE_SPAN = 33.9;

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

  // 10: The game's ring — the color is sampled from the 1D palette gradient
  // (blue core -> dark -> red ring -> dark edges) by the warped distance from
  // the center, so the ring boundaries follow the swirl instead of perfect
  // circles. The warp also FOLDS the distance field, which is what creates
  // the dark filaments weaving between the blue and red regions.
  vec3 color = texture2D(u_palette, vec2(length(p) / PALETTE_SPAN, 0.5)).rgb;

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

  // Upload the 1x256 palette gradient as a texture the shader can sample
  const paletteTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, paletteTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB,
    256,
    1,
    0,
    gl.RGB,
    gl.UNSIGNED_BYTE,
    PALETTE_LUT
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, "u_palette"), 0);

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

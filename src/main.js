// ================== Tunable parameters (tweak these while polishing) ==================
const CONFIG = {
  swirl: 4.0, // Twist intensity: the farther from the center, the more it turns (the 4.0 from tutorial step 03)
  spin: 0.25, // Global rotation speed in rad/s; the tutorial hardcoded 1.0 (one full turn every ~6.3s). Lower = slower
};

// The game's ring palette as a 1D gradient (256 RGB stops), measured from the
// game's own radial palette: a blue core in the middle, a red ring around it,
// dark edges beyond
const PALETTE_LUT = new Uint8Array([
  9,156,234,10,154,232,11,153,230,11,152,228,12,151,225,13,150,223,14,149,221,15,148,219,
  16,147,218,18,146,216,19,145,213,21,143,210,23,141,206,25,139,202,26,137,199,27,135,195,
  28,134,192,30,133,190,31,131,188,32,130,186,33,129,184,34,128,182,35,128,180,36,127,179,
  37,126,178,37,126,177,37,126,177,37,126,177,37,126,177,37,126,177,36,126,177,35,126,178,
  35,127,178,35,127,179,34,127,179,35,127,179,35,127,179,35,128,180,36,128,180,36,128,179,
  36,127,179,36,127,179,36,127,179,37,127,178,37,126,177,37,126,177,38,125,175,38,124,174,
  39,124,172,40,123,170,41,122,169,42,121,167,43,119,164,44,118,162,44,117,160,45,116,158,
  46,115,155,47,114,153,48,112,151,49,111,149,51,110,146,52,109,144,53,108,142,54,107,140,
  56,106,138,57,105,136,58,104,134,59,103,132,60,102,130,61,101,128,62,100,127,63,99,125,
  64,98,123,65,98,122,66,97,120,66,96,119,67,96,118,67,95,117,67,94,116,67,94,115,
  67,93,114,67,93,113,67,92,112,67,92,111,68,91,110,68,91,110,69,91,109,69,90,108,
  70,90,107,71,89,106,71,89,106,72,89,105,73,88,104,75,88,103,76,88,102,78,87,101,
  80,87,100,82,87,99,84,86,98,86,86,97,89,86,96,91,85,95,93,85,94,96,85,93,
  98,84,92,100,84,91,102,84,90,104,83,89,106,83,88,108,83,88,110,83,87,111,82,86,
  112,82,85,113,81,84,114,81,83,114,80,82,115,80,82,116,79,81,117,79,80,118,79,80,
  119,78,80,120,78,79,121,78,79,123,78,79,124,78,78,126,78,78,127,78,78,129,78,78,
  131,78,78,132,79,78,134,79,78,136,79,78,138,79,79,140,80,79,143,81,79,145,81,80,
  147,82,80,149,82,81,151,83,81,153,84,82,155,84,82,157,85,83,159,85,83,161,85,83,
  162,86,84,164,86,84,165,86,84,166,87,84,167,87,84,169,87,84,170,87,84,171,87,84,
  171,88,85,172,88,85,173,88,85,174,88,85,174,88,85,175,88,85,176,88,85,177,88,85,
  178,89,85,179,89,84,179,89,84,180,89,84,180,89,84,180,89,84,180,89,84,181,89,84,
  181,89,84,181,88,84,181,88,84,181,88,84,180,88,83,180,88,83,179,88,83,179,88,83,
  178,88,83,177,88,83,176,87,83,174,87,83,173,87,82,171,86,82,170,86,82,168,86,82,
  167,86,82,165,85,81,164,85,81,162,85,81,160,84,81,158,84,81,156,84,80,154,83,80,
  153,83,80,151,83,80,149,82,79,147,82,79,146,82,79,144,81,79,142,81,79,140,81,78,
  138,80,78,136,80,78,134,79,77,131,78,77,128,78,76,125,77,75,122,75,74,119,74,73,
  115,73,72,112,72,71,108,70,70,104,68,68,100,67,67,95,65,65,91,63,64,87,62,63,
  83,60,61,79,58,60,75,57,58,71,55,57,68,54,55,64,52,54,61,50,52,58,49,51,
  55,47,50,52,46,49,49,45,48,47,44,47,45,43,46,43,43,46,42,42,45,42,42,45,
  41,42,45,42,43,46,42,43,46,43,44,47,44,46,49,45,47,50,46,47,50,46,48,51,
  46,48,51,46,47,50,45,46,49,44,45,48,43,44,47,42,43,46,42,43,46,43,43,46,
  43,43,46,44,43,46,44,43,46,44,43,47,44,43,46,44,43,46,43,42,45,41,40,44,
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
uniform sampler2D u_palette; // 1D palette gradient: blue core -> red ring -> dark edges

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
  // (blue core -> red ring -> dark edges) by the warped distance from the
  // center, so the ring boundaries follow the swirl instead of perfect circles.
  // maxDist = the palette position at the screen corner.
  float maxDist = 30.0 * length(vec2(u_size.x / u_size.y * 0.5, 0.5));
  vec3 color = texture2D(u_palette, vec2(length(p) / maxDist, 0.5)).rgb;

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

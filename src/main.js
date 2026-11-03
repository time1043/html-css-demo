// ================== Tunable parameters (tweak these while polishing) ==================
const CONFIG = {
  spin: 0.25, // Global rotation speed in rad/s (accumulates into the swirl angle)
  flowSpeed: 7.0, // How fast the warp pattern evolves (the game uses speed*7 per second)
};

// The game's own menu colors (passed as colour_1/colour_2 externs by the game's Lua)
const COLOR1 = [0.871, 0.267, 0.231]; // #DE443B red
const COLOR2 = [0.0, 0.42, 0.706]; // #006BB4 blue
const COLOR3 = [0.086, 0.137, 0.145]; // #162325 dark

// Vertex shader: one big triangle covering the whole screen
const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Fragment shader: the game's actual background shader (ported from the
// decompiled swirl shader — see the Balatro modding community's recreations).
// The color is NOT a palette lookup: a scalar "smoke amount" is computed from
// the warped distance and blended between three colors, with a glossy
// highlight term on top.
const FRAG = /* glsl */ `
precision highp float;

uniform vec2 u_size;  // Canvas size in pixels
uniform float u_spin; // Accumulated swirl angle in radians
uniform float u_flow; // Accumulated warp phase

// The game's menu colors
const vec3 COLOR1 = vec3(0.871, 0.267, 0.231); // #DE443B red
const vec3 COLOR2 = vec3(0.0, 0.42, 0.706);    // #006BB4 blue
const vec3 COLOR3 = vec3(0.086, 0.137, 0.145); // #162325 dark

const float CONTRAST = 3.5;
const float LIGHTING = 0.4;
const float SWIRL = 0.25;

// Pixelate: each 3px block shares one address (the game pixelates by
// length(screen)/700, which lands around 2-3 px on a typical window)
const float PIXEL_SIZE = 3.0;

vec3 paint(vec2 coords) {
  vec2 uv = (coords - 0.5 * u_size) / length(u_size);
  float radius = length(uv);
  float speed = u_spin + 302.2;
  float angle = atan(uv.y, uv.x) + speed - 20.0 * (SWIRL * radius + (1.0 - SWIRL));
  vec2 mid = (u_size / length(u_size)) / 2.0;
  uv = vec2(radius * cos(angle) + mid.x, radius * sin(angle) + mid.y) - mid;

  uv *= 30.0;
  speed = u_flow;
  vec2 uv2 = vec2(uv.x + uv.y);
  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121), sin(uv2.x - 0.113 * speed));
    uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
  }

  float contrastMod = 0.25 * CONTRAST + 0.5 * SWIRL + 1.2;
  float amount = min(2.0, max(0.0, length(uv) * 0.035 * contrastMod));
  float c1 = max(0.0, 1.0 - CONTRAST * abs(1.0 - amount));
  float c2 = max(0.0, 1.0 - CONTRAST * abs(amount));
  float c3 = 1.0 - min(1.0, c1 + c2);
  float light = (LIGHTING - 0.2) * max(c1 * 5.0 - 4.0, 0.0) + LIGHTING * max(c2 * 5.0 - 4.0, 0.0);
  vec3 gap = COLOR3;
  float base = 0.3 / CONTRAST;
  vec3 color = base * COLOR1 + (1.0 - base) * (COLOR1 * c1 + COLOR2 * c2 + gap * c3) + light;
  return color;
}

void main() {
  // Pixelate: every PIXEL_SIZE block samples at its center
  vec2 pos = (floor(gl_FragCoord.xy / PIXEL_SIZE) + 0.5) * PIXEL_SIZE;
  vec3 color = paint(pos);
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
  const uSpin = gl.getUniformLocation(program, "u_spin");
  const uFlow = gl.getUniformLocation(program, "u_flow");

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

  // Render loop: the swirl angle accumulates at CONFIG.spin, the warp phase
  // at CONFIG.flowSpeed (both capped so the picture never jumps after a
  // background tab)
  let spinAngle = 0;
  let flow = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    spinAngle += dt * CONFIG.spin;
    flow += dt * CONFIG.flowSpeed;

    resize();
    gl.uniform2f(uSize, canvas.width, canvas.height);
    gl.uniform1f(uSpin, -0.4 + spinAngle);
    gl.uniform1f(uFlow, hasPinnedTime ? pinnedTime * CONFIG.flowSpeed : flow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init();

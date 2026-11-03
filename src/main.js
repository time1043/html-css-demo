// ================== Tunable parameters (tweak these while polishing) ==================
const CONFIG = {
  spin: 0.25, // Global rotation speed in rad/s (accumulates into the swirl angle)
  flowSpeed: 7.0, // How fast the warp pattern evolves (the game uses speed*7 per second)
};

// The game's per-state backdrop palettes: the post-easing colour triples the
// shader receives, ported from backdrop.lua (game.lua:2283-2291 +
// common_events.lua:276-360). Each entry drives the same swirl shader with a
// different colour_1/colour_2/colour_3 + contrast, exactly like the game
// recolours its backdrop per game state.
const BACKDROP_STATES = {
  menu: {
    label: '主菜单',
    c1: [0.871, 0.267, 0.231], c2: [0.0, 0.42, 0.706], c3: [0.086, 0.137, 0.145],
    contrast: 3.5,
  },
  blind: {
    label: '小/大盲注',
    c1: [0.282, 0.464, 0.388], c2: [0.408, 0.671, 0.561], c3: [0.219, 0.361, 0.302],
    contrast: 1.0,
  },
  tarot: {
    label: '塔罗包',
    c1: [0.031, 0.031, 0.031], c2: [0.573, 0.408, 0.937], c3: [0.012, 0.012, 0.012],
    contrast: 1.5,
  },
  spectral: {
    label: '幽灵包',
    c1: [0.031, 0.031, 0.031], c2: [0.286, 0.72, 0.976], c3: [0.012, 0.012, 0.012],
    contrast: 2.0,
  },
  standard: {
    label: '标准包',
    c1: [0.996, 0.373, 0.333], c2: [0.041, 0.041, 0.041], c3: [0.013, 0.013, 0.013],
    contrast: 3.0,
  },
  buffoon: {
    label: '小丑包',
    c1: [0.0, 0.0, 0.0], c2: [0.0, 0.74, 0.994], c3: [0.0, 0.0, 0.0],
    contrast: 2.0,
  },
  planet: {
    label: '星球包',
    c1: [0.0, 0.0, 0.0], c2: [0.0, 0.0, 0.0], c3: [0.0, 0.0, 0.0],
    contrast: 3.0,
  },
  boss: {
    label: 'Boss 盲注',
    c1: [0.482, 0.145, 0.121], c2: [0.243, 0.093, 0.082], c3: [0.193, 0.058, 0.048],
    contrast: 2.0,
  },
  showdown: {
    label: '决战',
    c1: [0.996, 0.373, 0.333], c2: [0.0, 0.616, 1.0], c3: [0.024, 0.024, 0.024],
    contrast: 3.0,
  },
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
// lighting term on top. The three colors and the contrast are externs the
// game eases per game state (see the STATES table below).
const FRAG = /* glsl */ `
precision highp float;

uniform vec2 u_size;        // Canvas size in pixels
uniform float u_swirl;      // Twist intensity
uniform float u_spin;       // Accumulated swirl angle in radians
uniform float u_flow;       // Accumulated warp phase
uniform vec3 u_c1;          // colour_1: the per-state base colour
uniform vec3 u_c2;          // colour_2: the per-state highlight colour
uniform vec3 u_c3;          // colour_3: the per-state deep tone
uniform float u_contrast;   // The per-state contrast

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

  float contrastMod = 0.25 * u_contrast + 0.5 * SWIRL + 1.2;
  float amount = min(2.0, max(0.0, length(uv) * 0.035 * contrastMod));
  float c1 = max(0.0, 1.0 - u_contrast * abs(1.0 - amount));
  float c2 = max(0.0, 1.0 - u_contrast * abs(amount));
  float c3 = 1.0 - min(1.0, c1 + c2);
  float light = (LIGHTING - 0.2) * max(c1 * 5.0 - 4.0, 0.0) + LIGHTING * max(c2 * 5.0 - 4.0, 0.0);
  vec3 gap = u_c3;
  float base = 0.3 / u_contrast;
  vec3 color = base * u_c1 + (1.0 - base) * (u_c1 * c1 + u_c2 * c2 + gap * c3) + light;
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
  const uC1 = gl.getUniformLocation(program, "u_c1");
  const uC2 = gl.getUniformLocation(program, "u_c2");
  const uC3 = gl.getUniformLocation(program, "u_c3");
  const uContrast = gl.getUniformLocation(program, "u_contrast");

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

  // The live (eased) colors and contrast. setBackdrop() moves the targets;
  // the frame loop walks the live values toward them (see EASE_SECONDS).
  const live = {
    c1: [0.871, 0.267, 0.231],
    c2: [0.0, 0.42, 0.706],
    c3: [0.086, 0.137, 0.145],
    contrast: 3.5,
  };

  // The backdrop state machine: setBackdrop() retargets the palette and the
  // frame loop eases the live values toward it. The game eases over 0.6s
  // (common_events.lua:299) with contrast at twice the step.
  const EASE_SECONDS = 0.6;
  const target = {
    c1: [...live.c1],
    c2: [...live.c2],
    c3: [...live.c3],
    contrast: live.contrast,
  };
  const approach = (current, targetValue, step) => {
    const delta = targetValue - current;
    if (delta > step) return current + step;
    if (delta < -step) return current - step;
    return targetValue;
  };
  function setBackdrop(name) {
    const palette = BACKDROP_STATES[name];
    if (!palette) return;
    target.c1 = [...palette.c1];
    target.c2 = [...palette.c2];
    target.c3 = [...palette.c3];
    target.contrast = palette.contrast;
    const label = document.getElementById('backdrop-label');
    if (label) label.textContent = `${palette.label}（${name}）`;
  }
  setBackdrop('menu');

  // Flip through the palettes with number keys, like the game does per game state
  window.addEventListener('keydown', (event) => {
    const names = Object.keys(BACKDROP_STATES);
    const index = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].indexOf(event.key);
    if (index >= 0 && names[index]) setBackdrop(names[index]);
  });

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

    // Ease the live colours toward the backdrop targets: the game walks them
    // over 0.6s (common_events.lua:299), contrast at twice the step
    const step = dt / EASE_SECONDS;
    for (let i = 0; i < 3; i++) {
      live.c1[i] = approach(live.c1[i], target.c1[i], step);
      live.c2[i] = approach(live.c2[i], target.c2[i], step);
      live.c3[i] = approach(live.c3[i], target.c3[i], step);
    }
    live.contrast = approach(live.contrast, target.contrast, step * 2);

    resize();
    gl.uniform2f(uSize, canvas.width, canvas.height);
    gl.uniform1f(uSpin, -0.4 + spinAngle);
    gl.uniform1f(uFlow, hasPinnedTime ? pinnedTime * CONFIG.flowSpeed : flow);
    gl.uniform3f(uC1, live.c1[0], live.c1[1], live.c1[2]);
    gl.uniform3f(uC2, live.c2[0], live.c2[1], live.c2[2]);
    gl.uniform3f(uC3, live.c3[0], live.c3[1], live.c3[2]);
    gl.uniform1f(uContrast, live.contrast);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init();

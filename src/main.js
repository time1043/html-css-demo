// ================== Tunable parameters (tweak these while polishing) ==================
const CONFIG = {
  swirl: 4.0, // Twist intensity: the farther from the center, the more it turns (the 4.0 from tutorial step 03)
  freq: 0.8, // Color band frequency: higher means narrower bands (fitted to the tutorial)
};

// Shader sources live in their own files (real .vert/.frag files with GLSL
// syntax highlighting) instead of being embedded as JS strings
const VERT_URL = "./swirl.vert";
const FRAG_URL = "./swirl.frag";

// Fetch a shader source file
async function loadShaderSource(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url}: HTTP ${res.status}`);
  }
  return res.text();
}

async function init() {
  const canvas = document.getElementById("swirl");
  const gl =
    canvas.getContext("webgl", { antialias: false }) ||
    canvas.getContext("experimental-webgl");

  // Fall back to a static CSS gradient when WebGL is unavailable
  if (!gl) {
    document.body.classList.add("no-webgl");
    return;
  }

  // Load the shader files; on failure (e.g. the page opened via file://,
  // where fetch is blocked by the browser) fall back to the CSS gradient
  let vertSource;
  let fragSource;
  try {
    [vertSource, fragSource] = await Promise.all([
      loadShaderSource(VERT_URL),
      loadShaderSource(FRAG_URL),
    ]);
  } catch (err) {
    console.error("Failed to load the shader files:", err);
    document.body.classList.add("no-webgl");
    return;
  }

  // Compile a shader; log the info log with the file name on failure
  function compile(type, source, name) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`${name} failed to compile:\n${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSource, VERT_URL));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSource, FRAG_URL));
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
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uSize = gl.getUniformLocation(program, "u_size");
  const uFreq = gl.getUniformLocation(program, "u_freq");
  const uSwirl = gl.getUniformLocation(program, "u_swirl");

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

  // One draw pass: sync the backing store, push uniforms, draw
  function render() {
    resize();
    gl.uniform2f(uSize, canvas.width, canvas.height);
    gl.uniform1f(uFreq, CONFIG.freq);
    gl.uniform1f(uSwirl, CONFIG.swirl);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Render loop: the picture is static for now, but the loop is the skeleton
  // that the upcoming animation steps will plug into
  function frame() {
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Redraw on events that can happen while rAF is throttled (hidden tab):
  // window resize, visibility returning, and device-pixel-ratio flips
  // (the resize event does not fire for DPR-only changes)
  const redraw = () => render();
  window.addEventListener("resize", redraw);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) redraw();
  });
  function watchDpr() {
    const query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener(
      "change",
      () => {
        redraw();
        watchDpr();
      },
      { once: true }
    );
  }
  watchDpr();
}

init();

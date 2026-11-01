import { useEffect, useRef, useState } from 'react'

import fragSource from '@/shaders/swirl.frag?raw'
import vertSource from '@/shaders/swirl.vert?raw'

// ================== Tunable parameters (tweak these while polishing) ==================
const CONFIG = {
  swirl: 4.0, // Twist intensity: the farther from the center, the more it turns (the 4.0 from tutorial step 03)
  freq: 0.8, // Color band frequency: higher means narrower bands (fitted to the tutorial)
}

export default function SwirlBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [glUnavailable, setGlUnavailable] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { antialias: false })
    if (!gl) {
      setGlUnavailable(true)
      return
    }

    // Compile a shader; log the info log with the file name on failure
    const compileShader = (type: number, source: string, name: string): WebGLShader | null => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`${name} failed to compile:\n${gl.getShaderInfoLog(shader)}`)
      }
      return shader
    }

    const vert = compileShader(gl.VERTEX_SHADER, vertSource, 'swirl.vert')
    const frag = compileShader(gl.FRAGMENT_SHADER, fragSource, 'swirl.frag')
    const program = gl.createProgram()
    if (!vert || !frag || !program) {
      console.error('Failed to create WebGL shader objects')
      setGlUnavailable(true)
      return
    }
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program))
      setGlUnavailable(true)
      return
    }
    gl.useProgram(program)

    // The fullscreen big triangle
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uSize = gl.getUniformLocation(program, 'u_size')
    const uFreq = gl.getUniformLocation(program, 'u_freq')
    const uSwirl = gl.getUniformLocation(program, 'u_swirl')

    // Track the window size and render at the device pixel ratio (capped at 2 so high-DPI screens stay fast)
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    // One draw pass: sync the backing store, push uniforms, draw
    const render = () => {
      resize()
      gl.uniform2f(uSize, canvas.width, canvas.height)
      gl.uniform1f(uFreq, CONFIG.freq)
      gl.uniform1f(uSwirl, CONFIG.swirl)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    // Render loop: the picture is static for now, but the loop is the skeleton
    // that the upcoming animation steps will plug into
    let rafId = requestAnimationFrame(function frame() {
      render()
      rafId = requestAnimationFrame(frame)
    })

    // Redraw on events that can happen while rAF is throttled (hidden tab):
    // window resize, visibility returning, and device-pixel-ratio flips
    // (the resize event does not fire for DPR-only changes)
    window.addEventListener('resize', render)
    const onVisibilityChange = () => {
      if (!document.hidden) render()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    let dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    const onDprChange = () => {
      render()
      dprQuery.removeEventListener('change', onDprChange)
      dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      dprQuery.addEventListener('change', onDprChange)
    }
    dprQuery.addEventListener('change', onDprChange)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', render)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      dprQuery.removeEventListener('change', onDprChange)
      // Free the GL objects but keep the context itself alive, so React
      // strict mode can re-initialize on the same canvas afterwards
      gl.deleteBuffer(buf)
      gl.deleteProgram(program)
      gl.deleteShader(vert)
      gl.deleteShader(frag)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`swirl-canvas${glUnavailable ? ' no-webgl' : ''}`}
      aria-hidden="true"
    />
  )
}

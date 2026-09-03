import React, { useCallback, useRef, useEffect } from 'react';

const useThrottledCallback = (callback: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: any[]) => {
    if (!timeoutRef.current) {
      callbackRef.current(...args);
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
      }, delay);
    }
  }, [delay]);
};

interface ShaderParams {
  hue?: number;
  speed?: number;
  intensity?: number;
  complexity?: number;
}

const InteractiveShaderBackground = ({ hue = 210, speed = 0.4, intensity = 1.2, complexity = 5.0 }: ShaderParams) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  const throttledMouseMove = useThrottledCallback((e: MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mousePos.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mousePos.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }, 16);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return;

    const vertexShaderSource = `attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_hue;
      uniform float u_speed;
      uniform float u_intensity;
      uniform float u_complexity;

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
      float noise(vec2 st) {
        vec2 i = floor(st); vec2 f = fract(st);
        float a = random(i); float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
      }
      float fbm(vec2 st) {
        float value = 0.0; float amplitude = 0.5;
        for (int i = 0; i < 10; i++) {
          if (float(i) >= u_complexity) break;
          value += amplitude * noise(st); st *= 2.0; amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float t = u_time * u_speed * 0.1;
        float mouse_dist = distance(uv, u_mouse);
        float warp = smoothstep(0.5, 0.0, mouse_dist) * 0.5;
        vec2 p = uv * 2.0 + vec2(t, t * 0.5) + warp;
        float noise_pattern = fbm(p);
        float vignette = 1.0 - smoothstep(0.8, 1.5, length(uv));
        float saturation = 0.6 + noise_pattern * 0.4;
        float value = 0.2 + (noise_pattern * 0.8) * u_intensity * vignette;
        vec3 color = hsv2rgb(vec3(u_hue / 360.0, saturation, value));
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const mouseLoc = gl.getUniformLocation(program, "u_mouse");
    const hueLoc = gl.getUniformLocation(program, "u_hue");
    const speedLoc = gl.getUniformLocation(program, "u_speed");
    const intensityLoc = gl.getUniformLocation(program, "u_intensity");
    const complexityLoc = gl.getUniformLocation(program, "u_complexity");

    let animationFrameId: number;
    const startTime = performance.now();
    const render = () => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      }
      gl.uniform2f(resLoc, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(timeLoc, (performance.now() - startTime) * 0.001);
      gl.uniform2f(mouseLoc, mousePos.current.x, mousePos.current.y);
      gl.uniform1f(hueLoc, hue);
      gl.uniform1f(speedLoc, speed);
      gl.uniform1f(intensityLoc, intensity);
      gl.uniform1f(complexityLoc, complexity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    window.addEventListener('mousemove', throttledMouseMove);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', throttledMouseMove);
      if (gl && !gl.isContextLost()) {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteBuffer(positionBuffer);
      }
    };
  }, [hue, speed, intensity, complexity, throttledMouseMove]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default InteractiveShaderBackground;

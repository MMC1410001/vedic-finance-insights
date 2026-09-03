import { useEffect, useRef } from 'react';

interface NeuralNoiseProps {
  color?: [number, number, number];
  opacity?: number;
  speed?: number;
}

export function NeuralNoise({ color = [0.9, 0.2, 0.4], opacity = 0.95, speed = 0.001 }: NeuralNoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const pointer = { x: 0, y: 0, tX: 0, tY: 0 };
    let gl: WebGLRenderingContext | null = null;
    let uniforms: Record<string, WebGLUniformLocation | null> = {};
    let animId: number;

    const vsSource = `
      precision mediump float;
      varying vec2 vUv;
      attribute vec2 a_position;
      void main() {
        vUv = 0.5 * (a_position + 1.0);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }`;

    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_ratio;
      uniform vec2 u_pointer_position;
      uniform vec3 u_color;
      uniform float u_speed;

      vec2 rotate(vec2 uv, float th) {
        return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
      }

      float neuro_shape(vec2 uv, float t, float p) {
        vec2 sine_acc = vec2(0.0);
        vec2 res = vec2(0.0);
        float scale = 8.0;
        for (int j = 0; j < 15; j++) {
          uv = rotate(uv, 1.0);
          sine_acc = rotate(sine_acc, 1.0);
          vec2 layer = uv * scale + float(j) + sine_acc - t;
          sine_acc += sin(layer) + 2.4 * p;
          res += (0.5 + 0.5 * cos(layer)) / scale;
          scale *= 1.2;
        }
        return res.x + res.y;
      }

      void main() {
        vec2 uv = 0.5 * vUv;
        uv.x *= u_ratio;
        vec2 pointer = vUv - u_pointer_position;
        pointer.x *= u_ratio;
        float p = clamp(length(pointer), 0.0, 1.0);
        p = 0.5 * pow(1.0 - p, 2.0);
        float t = u_speed * u_time;
        vec3 col = vec3(0.0);
        float noise = neuro_shape(uv, t, p);
        noise = 1.2 * pow(noise, 3.0);
        noise += pow(noise, 10.0);
        noise = max(0.0, noise - 0.5);
        noise *= (1.0 - length(vUv - 0.5));
        col = u_color * noise;
        gl_FragColor = vec4(col, noise);
      }`;

    function createShader(ctx: WebGLRenderingContext, source: string, type: number) {
      const shader = ctx.createShader(type)!;
      ctx.shaderSource(shader, source);
      ctx.compileShader(shader);
      if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
        ctx.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function createProgram(ctx: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
      const program = ctx.createProgram()!;
      ctx.attachShader(program, vs);
      ctx.attachShader(program, fs);
      ctx.linkProgram(program);
      if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) return null;
      return program;
    }

    function getUniforms(ctx: WebGLRenderingContext, program: WebGLProgram) {
      const result: Record<string, WebGLUniformLocation | null> = {};
      const count = ctx.getProgramParameter(program, ctx.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = ctx.getActiveUniform(program, i)!.name;
        result[name] = ctx.getUniformLocation(program, name);
      }
      return result;
    }

    function resizeCanvas() {
      const canvas = canvasRef.current;
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      if (uniforms.u_ratio) gl.uniform1f(uniforms.u_ratio, canvas.width / canvas.height);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render() {
      if (!gl) return;
      pointer.x += (pointer.tX - pointer.x) * 0.2;
      pointer.y += (pointer.tY - pointer.y) * 0.2;
      gl.uniform1f(uniforms.u_time, performance.now());
      gl.uniform2f(uniforms.u_pointer_position,
        pointer.x / window.innerWidth,
        1 - pointer.y / window.innerHeight
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = createShader(gl, vsSource, gl.VERTEX_SHADER);
    const fs = createShader(gl, fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = createProgram(gl, vs, fs);
    if (!program) return;

    uniforms = getUniforms(gl, program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.useProgram(program);

    const pos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform3f(uniforms.u_color, color[0], color[1], color[2]);
    gl.uniform1f(uniforms.u_speed, speed);

    resizeCanvas();

    const onResize = () => resizeCanvas();
    const onMove = (e: PointerEvent) => { pointer.tX = e.clientX; pointer.tY = e.clientY; };
    const onTouch = (e: TouchEvent) => { if (e.targetTouches[0]) { pointer.tX = e.targetTouches[0].clientX; pointer.tY = e.targetTouches[0].clientY; } };
    const onClick = (e: MouseEvent) => { pointer.tX = e.clientX; pointer.tY = e.clientY; };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('touchmove', onTouch);
    window.addEventListener('click', onClick);

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('click', onClick);
    };
  }, [color, speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
      }}
    />
  );
}

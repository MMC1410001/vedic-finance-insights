import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const AnimatedShaderBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    container.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(rect.width, rect.height) }
      },
      vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;

        #define NUM_OCTAVES 3

        float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }

        float noise(vec2 p) {
          vec2 ip = floor(p); vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);
          float res = mix(mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0; float a = 0.3; vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) { v += a * noise(x); x = rot * x * 2.0 + shift; a *= 0.4; }
          return v;
        }

        // Meteor / shooting star
        float meteor(vec2 uv, float t) {
          float total = 0.0;
          for (float i = 0.0; i < 4.0; i++) {
            float seed = i * 17.31;
            float cycle = mod(t * (0.3 + i * 0.08) + seed, 6.0 + i * 2.0);
            float life = smoothstep(0.0, 0.3, cycle) * smoothstep(2.5, 0.5, cycle);
            float angle = -0.6 - i * 0.15;
            float startX = fract(sin(seed * 43.17) * 91.7) * 1.6 - 0.3;
            float startY = 0.8 + fract(cos(seed * 27.3) * 53.1) * 0.4;
            vec2 dir = vec2(cos(angle), sin(angle));
            vec2 pos = vec2(startX, startY) + dir * cycle * 0.4;
            vec2 d = uv - pos;
            float along = dot(d, dir);
            float perp = length(d - along * dir);
            float tail = smoothstep(0.0, -0.25, along) * smoothstep(-0.5, -0.1, along);
            float width = exp(-perp * (80.0 + i * 20.0));
            float head = exp(-length(d) * 40.0);
            total += (tail * width * 0.6 + head * 1.2) * life;
          }
          return total;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / iResolution.xy;
          vec2 p = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.y;

          // Medium purple base — matches new landing page splash aesthetic
          vec3 deepViolet = vec3(0.30, 0.15, 0.50);     // #4D2680 darker edge
          vec3 midPurple = vec3(0.45, 0.25, 0.65);      // #7340A6 dominant mid-purple
          vec3 brightViolet = vec3(0.55, 0.33, 0.72);   // #8C54B8 lighter glow areas

          vec3 bg = mix(deepViolet, midPurple, smoothstep(0.0, 0.6, uv.y));
          bg = mix(bg, brightViolet, smoothstep(0.3, 1.0, uv.x * 0.5 + uv.y * 0.4));

          // Subtle nebula / cosmic fog
          float n1 = fbm(p * 3.0 + vec2(iTime * 0.08, iTime * 0.05));
          float n2 = fbm(p * 5.0 - vec2(iTime * 0.06, iTime * 0.04));

          vec3 softPink = vec3(0.75, 0.45, 0.70);       // subtle pink-purple glow
          vec3 lavender = vec3(0.70, 0.55, 0.90);       // soft lavender
          vec3 gold = vec3(0.949, 0.773, 0.447);        // #F2C572

          bg += softPink * n1 * 0.10;
          bg += lavender * n2 * 0.06;

          // Soft radial light glow in upper-left (like the landing page lens flare)
          vec2 glowCenter = vec2(-0.3, 0.25);
          float centerGlow = exp(-length(p - glowCenter) * 2.5);
          bg += vec3(0.75, 0.5, 0.85) * centerGlow * 0.15;

          // Twinkling stars — smaller, subtler white dots
          float stars = 0.0;
          for (float i = 0.0; i < 50.0; i++) {
            vec2 starPos = vec2(
              fract(sin(i * 93.17) * 437.5) - 0.5,
              fract(cos(i * 57.31) * 319.8) - 0.5
            ) * 2.0;
            float twinkle = sin(iTime * (1.5 + fract(i * 0.37) * 2.0) + i) * 0.5 + 0.5;
            float brightness = exp(-length(p - starPos) * (250.0 + i * 8.0)) * twinkle;
            stars += brightness;
          }
          bg += vec3(0.95, 0.90, 1.0) * stars * 0.6;

          // Meteors with white-lilac tint
          float m = meteor(uv, iTime);
          vec3 meteorColor = mix(vec3(0.85, 0.75, 1.0), vec3(1.0, 0.97, 0.92), 0.4);
          bg += meteorColor * m * 1.0;

          // Subtle aurora wisps in purple/pink
          vec2 shake = vec2(sin(iTime * 1.2) * 0.003, cos(iTime * 2.1) * 0.003);
          vec2 ap = (gl_FragCoord.xy + shake * iResolution.xy - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
          vec4 aurora = vec4(0.0);
          float f = 2.0 + fbm(ap + vec2(iTime * 3.0, 0.0)) * 0.5;
          for (float i = 0.0; i < 25.0; i++) {
            vec2 v = ap + cos(i * i + (iTime + ap.x * 0.08) * 0.02 + i * vec2(13.0, 11.0)) * 3.5;
            // Purple-pink-gold palette for aurora
            vec4 auroraCol = vec4(
              0.35 + 0.25 * sin(i * 0.2 + iTime * 0.3),
              0.12 + 0.15 * cos(i * 0.3 + iTime * 0.4),
              0.45 + 0.35 * sin(i * 0.15 + iTime * 0.25),
              1.0
            );
            vec4 contrib = auroraCol * exp(sin(i * i + iTime * 0.6)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thin = smoothstep(0.0, 1.0, i / 25.0) * 0.5;
            aurora += contrib * thin;
          }
          aurora = tanh(pow(aurora / 80.0, vec4(1.6)));
          bg += aurora.rgb * 0.2;

          gl_FragColor = vec4(bg, 1.0);
        }
      `
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let frameId: number;
    const animate = () => {
      material.uniforms.iTime.value += 0.016;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const r = container.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      material.uniforms.iResolution.value.set(r.width, r.height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};

export default AnimatedShaderBackground;

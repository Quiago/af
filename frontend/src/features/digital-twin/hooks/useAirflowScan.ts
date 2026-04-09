import * as THREE from 'three'

// ─── Shaders ──────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision mediump float;

  uniform sampler2D uSceneTex;
  uniform float     uTime;
  uniform float     uIntensity;   // 0..1 — animated in/out

  varying vec2 vUv;

  // ── Voronoi cell noise (equivalent to mx_cell_noise_float) ────────────
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float cellNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minD = 1.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = n + vec2(hash2(i + n), hash2(i + n + vec2(37.0, 17.0))) - f;
        minD = min(minD, dot(pt, pt));
      }
    }
    return sqrt(minD);
  }

  // ── Temperature palette: cold-blue → warm-orange → hot-red ───────────
  vec3 tempColor(float t) {
    vec3 cold = vec3(0.10, 0.44, 0.78);   // #1a70c8
    vec3 warm = vec3(0.94, 0.50, 0.13);   // #f08020
    vec3 hot  = vec3(0.88, 0.13, 0.06);   // #e02010
    if (t < 0.5) return mix(cold, warm, t * 2.0);
    return mix(warm, hot, (t - 0.5) * 2.0);
  }

  // ── Screen-blend ──────────────────────────────────────────────────────
  vec3 blendScreen(vec3 base, vec3 blend, float opacity) {
    vec3 s = 1.0 - (1.0 - base) * (1.0 - blend);
    return mix(base, s, opacity);
  }

  void main() {
    vec4 sceneColor = texture2D(uSceneTex, vUv);

    // Scan wave: travels left → right, ~3.3s period
    float scanPos   = mod(uTime * 0.30, 1.0);
    float scanFront = smoothstep(0.0, 0.04, vUv.x - scanPos);
    float scanBack  = smoothstep(0.0, 0.12, scanPos - vUv.x + 0.14);
    float flow      = (1.0 - scanFront) * scanBack;

    // Cell noise dots — tightly tiled
    float noise = cellNoise(vUv * vec2(58.0, 38.0));
    float dots  = smoothstep(0.50, 0.44, noise);

    // Temperature: warmer at top (supply air), cooler at bottom (return)
    float tempT    = 1.0 - vUv.y * 0.65;
    vec3  dotColor = tempColor(clamp(tempT, 0.0, 1.0));

    // Scan-front glow: teal pulse at the wave leading edge
    float frontDist = abs(vUv.x - scanPos);
    float frontGlow = smoothstep(0.055, 0.0, frontDist);
    vec3  glowColor = vec3(0.396, 0.553, 0.533);   // #658D88 sage teal

    // Building mask: dots only render on lit geometry (not empty sky/background).
    // smoothstep 0.04→0.18 means fully invisible on pure black, full on building surfaces.
    float sceneLuma   = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));
    float buildingMask = smoothstep(0.04, 0.18, sceneLuma);

    float dotAlpha  = dots  * flow  * uIntensity * 0.85 * buildingMask;
    float glowAlpha = frontGlow     * uIntensity * 0.45;

    vec3 result = sceneColor.rgb;
    result = blendScreen(result, dotColor, dotAlpha);
    result = blendScreen(result, glowColor, glowAlpha);

    gl_FragColor = vec4(result, 1.0);
  }
`

// ─── Public interface ─────────────────────────────────────────────────────────

export interface AirflowScan {
  /** Call once per frame — wraps renderer.render(). */
  render(clock: THREE.Clock): void
  /** Set target intensity (0 = off, 1 = full). Lerps smoothly. */
  setIntensityTarget(t: number): void
  /** Call when canvas size changes. */
  resize(w: number, h: number): void
  dispose(): void
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAirflowScan(
  renderer: THREE.WebGLRenderer,
  scene:    THREE.Scene,
  camera:   THREE.Camera,
): AirflowScan {
  let w = renderer.domElement.width  || 1
  let h = renderer.domElement.height || 1

  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format:    THREE.RGBAFormat,
  })

  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const orthoScene  = new THREE.Scene()

  const uniforms = {
    uSceneTex: { value: rt.texture },
    uTime:     { value: 0 },
    uIntensity:{ value: 0 },
  }

  const scanMat = new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms,
    depthTest:  false,
    depthWrite: false,
  })

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), scanMat)
  quad.frustumCulled = false
  orthoScene.add(quad)

  let intensityTarget = 0

  return {
    render(clock: THREE.Clock) {
      // Lerp intensity
      uniforms.uIntensity.value += (intensityTarget - uniforms.uIntensity.value) * 0.06
      uniforms.uTime.value = clock.getElapsedTime()

      const usePostFx = uniforms.uIntensity.value > 0.01

      if (usePostFx) {
        // Pass 1: render scene → render target
        renderer.setRenderTarget(rt)
        renderer.render(scene, camera)
        renderer.setRenderTarget(null)
        // Pass 2: scan shader → canvas
        uniforms.uSceneTex.value = rt.texture
        renderer.render(orthoScene, orthoCamera)
      } else {
        // No effect — direct render (cheaper)
        renderer.setRenderTarget(null)
        renderer.render(scene, camera)
      }
    },

    setIntensityTarget(t: number) {
      intensityTarget = Math.max(0, Math.min(1, t))
    },

    resize(newW: number, newH: number) {
      w = newW; h = newH
      rt.setSize(newW, newH)
    },

    dispose() {
      rt.dispose()
      scanMat.dispose()
      quad.geometry.dispose()
    },
  }
}

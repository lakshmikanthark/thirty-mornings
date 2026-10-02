const TAU = Math.PI * 2;
const glClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function makeProgram(gl, vertex, fragment, bindings = {}) {
  const result = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(result, vs);
  gl.attachShader(result, fs);
  Object.entries(bindings).forEach(([name, loc]) => gl.bindAttribLocation(result, loc, name));
  gl.linkProgram(result);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(result) || 'unknown link error';
    gl.deleteProgram(result);
    throw new Error(message);
  }
  return result;
}

function hash01(value) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function chooseQuality() {
  const minSide = Math.min(window.innerWidth, window.innerHeight);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (minSide < 480 || cores <= 4 || memory <= 2) return { name: 'low', pads: 360, motes: 26, dpr: 1.05 };
  if (minSide < 900 || cores <= 6 || memory <= 4) return { name: 'medium', pads: 520, motes: 40, dpr: 1.25 };
  return { name: 'high', pads: 720, motes: 58, dpr: 1.45 };
}

function vec3Normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
function vec3Cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function vec3Sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

function mat4Perspective(fovRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovRadians / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4LookAt(eye, target, up = [0, 1, 0]) {
  const z = vec3Normalize(vec3Sub(eye, target));
  const x = vec3Normalize(vec3Cross(up, z));
  const y = vec3Cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1,
  ]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

const CAMERA_KEYS = [
  { p: 0.00, eye: [-1.10, 0.92, 5.05], target: [1.75, 0.03, -0.95], fov: 34 },
  { p: 0.10, eye: [-0.55, 1.10, 5.15], target: [1.45, 0.03, -0.98], fov: 35 },
  { p: 0.27, eye: [0.75, 1.55, 5.55], target: [0.40, 0.03, -1.10], fov: 37 },
  { p: 0.45, eye: [-0.55, 2.15, 5.85], target: [0.65, 0.03, -1.00], fov: 39 },
  // Push the crowded pond to the right while the question stays left.
  { p: 0.62, eye: [0.90, 3.05, 6.10], target: [1.00, 0.03, -1.05], fov: 39 },
  { p: 0.72, eye: [0.45, 3.75, 6.30], target: [0.85, 0.03, -0.95], fov: 38 },
  // Rise into a clear near-overhead answer view.
  { p: 0.82, eye: [0.15, 8.90, 2.45], target: [0.00, 0.00, -0.85], fov: 35 },
  { p: 0.91, eye: [-0.10, 8.55, 2.65], target: [0.00, 0.00, -0.85], fov: 35 },
  { p: 0.955, eye: [0.25, 6.20, 4.25], target: [0.00, 0.00, -0.90], fov: 36 },
  { p: 1.00, eye: [0.00, 2.55, 5.55], target: [0.00, 0.00, -0.95], fov: 36 },
];

function cameraForProgress(progress, pointer, reducedMotion) {
  const p = glClamp(progress, 0, 1);
  let a = CAMERA_KEYS[0];
  let b = CAMERA_KEYS[CAMERA_KEYS.length - 1];
  for (let i = 0; i < CAMERA_KEYS.length - 1; i += 1) {
    if (p >= CAMERA_KEYS[i].p && p <= CAMERA_KEYS[i + 1].p) { a = CAMERA_KEYS[i]; b = CAMERA_KEYS[i + 1]; break; }
  }
  const raw = (p - a.p) / Math.max(0.0001, b.p - a.p);
  const t = smoothstep(glClamp(raw, 0, 1));
  const eye = lerp3(a.eye, b.eye, t);
  const target = lerp3(a.target, b.target, t);
  if (!reducedMotion) {
    eye[0] += pointer.x * 0.22;
    eye[1] += pointer.y * -0.08;
    target[0] += pointer.x * 0.06;
  }
  return { eye, target, fov: lerp(a.fov, b.fov, t) };
}

function ringPoint(angle, radius, yBias = 0) {
  const organic = radius * (1 + Math.sin(angle * 3.0 + 0.35) * 0.022 + Math.sin(angle * 7.0) * 0.008);
  const curl = Math.sin(angle * 2.0 + 0.7) * 0.018 + Math.cos(angle * 5.0) * 0.007;
  return [Math.cos(angle) * organic, yBias + curl, Math.sin(angle) * organic];
}

function makePadGeometry(segments = 40) {
  const gap = 0.27;
  const data = [];
  const push = (p, n) => data.push(p[0], p[1], p[2], n[0], n[1], n[2]);
  const topNormal = (angle, slope = 0.10) => vec3Normalize([-Math.cos(angle) * slope, 1, -Math.sin(angle) * slope]);

  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const a0 = gap + t0 * (TAU - gap * 2);
    const a1 = gap + t1 * (TAU - gap * 2);
    const c = [0, 0.025, 0];
    const m0 = ringPoint(a0, 0.55, 0.045);
    const m1 = ringPoint(a1, 0.55, 0.045);
    const o0 = ringPoint(a0, 1.0, 0.005);
    const o1 = ringPoint(a1, 1.0, 0.005);

    // Curved top: center -> inner ring, inner ring -> organic edge.
    push(c, [0,1,0]); push(m0, topNormal(a0, 0.08)); push(m1, topNormal(a1, 0.08));
    push(m0, topNormal(a0, 0.10)); push(o0, topNormal(a0, 0.16)); push(o1, topNormal(a1, 0.16));
    push(m0, topNormal(a0, 0.10)); push(o1, topNormal(a1, 0.16)); push(m1, topNormal(a1, 0.10));

    // Thin wet edge. This is enough thickness to read as 3D without becoming a green wedge.
    const b0 = [o0[0] * 0.997, o0[1] - 0.050, o0[2] * 0.997];
    const b1 = [o1[0] * 0.997, o1[1] - 0.050, o1[2] * 0.997];
    const n0 = vec3Normalize([o0[0], 0.05, o0[2]]);
    const n1 = vec3Normalize([o1[0], 0.05, o1[2]]);
    push(o0, n0); push(b0, n0); push(b1, n1);
    push(o0, n0); push(b1, n1); push(o1, n1);
  }
  return new Float32Array(data);
}

const OPENING_PADS = [
  [2.15, -0.95, 0.88, 0.10],
  [1.10, -1.08, 0.66, -0.24],
  [2.75, -1.55, 0.54, 0.28],
  [1.90, -1.80, 0.48, -0.10],
  [3.20, -0.75, 0.43, 0.44],
  [0.75, -1.62, 0.40, 0.62],
  [2.55, -2.22, 0.38, -0.48],
  [1.35, -2.25, 0.36, 0.14],
  [3.58, -1.40, 0.34, -0.20],
  [0.55, -0.78, 0.33, 0.22],
  [2.15, -0.30, 0.32, 0.50],
  [1.05, -0.35, 0.31, -0.38],
  [3.45, -2.15, 0.31, 0.35],
  [0.30, -2.18, 0.30, -0.42],
  [2.95, -2.72, 0.29, 0.12],
  [1.55, -2.85, 0.29, -0.08],
];

function makePadInstances(count) {
  const items = [];
  for (let i = 0; i < Math.max(0, count - OPENING_PADS.length); i += 1) {
    const u = hash01(i + 19);
    const v = hash01(i + 43);
    const r = Math.sqrt(u);
    const angle = TAU * v;
    const x = Math.cos(angle) * r * 7.25 + (hash01(i + 101) - 0.5) * 0.15;
    const z = Math.sin(angle) * r * 4.85 - 0.95 + (hash01(i + 111) - 0.5) * 0.12;
    items.push({
      x, z,
      scale: 0.22 + hash01(i + 131) * 0.17,
      rot: TAU * hash01(i + 151),
      tx: (hash01(i + 171) - 0.5) * 0.12,
      tz: (hash01(i + 191) - 0.5) * 0.12,
      shade: hash01(i + 211),
      phase: TAU * hash01(i + 231),
      key: hash01(i + 251),
    });
  }
  items.sort((a, b) => a.key - b.key);

  const all = OPENING_PADS.map((p, i) => ({
    x: p[0], z: p[1], scale: p[2], rot: p[3],
    tx: (hash01(i + 301) - 0.5) * 0.08,
    tz: (hash01(i + 321) - 0.5) * 0.08,
    shade: 0.25 + hash01(i + 341) * 0.45,
    phase: TAU * hash01(i + 361), key: i / 10000,
  })).concat(items);

  const data = new Float32Array(count * 10);
  for (let i = 0; i < count; i += 1) {
    const item = all[i];
    const base = i * 10;
    data[base + 0] = item.x;
    data[base + 1] = 0.055 + (hash01(i + 401) - 0.5) * 0.025;
    data[base + 2] = item.z;
    data[base + 3] = item.scale;
    data[base + 4] = item.rot;
    data[base + 5] = item.tx;
    data[base + 6] = item.tz;
    data[base + 7] = item.shade;
    data[base + 8] = item.phase;
    data[base + 9] = glClamp(1.0 - ((item.x + 7.25) / 14.5), 0, 1);
  }
  return data;
}

function visualPadCount(day, coverage, maxPads) {
  if (day <= 5.05) return Math.min(maxPads, Math.max(1, Math.round(2 ** Math.max(0, day - 1))));
  const earlyFloor = Math.round(16 + glClamp((day - 5) / 20, 0, 1) * 20);
  return Math.min(maxPads, Math.max(earlyFloor, Math.ceil(maxPads * coverage)));
}

function makeMotes(count) {
  const data = new Float32Array(count * 5);
  for (let i = 0; i < count; i += 1) {
    const base = i * 5;
    data[base + 0] = (hash01(i + 501) - 0.5) * 14;
    data[base + 1] = 0.7 + hash01(i + 521) * 3.0;
    data[base + 2] = -5.2 + hash01(i + 541) * 10.2;
    data[base + 3] = 12 + hash01(i + 561) * 20;
    data[base + 4] = hash01(i + 581) * TAU;
  }
  return data;
}

const BG_VS = `
attribute vec2 aClip;
varying vec2 vUv;
void main() {
  vUv = aClip * 0.5 + 0.5;
  gl_Position = vec4(aClip, 0.9999, 1.0);
}`;

const BG_FS = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uProgress;
uniform vec2 uPointer;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  p.x *= 1.55;
  vec3 skyTop = vec3(0.38, 0.64, 0.76);
  vec3 skyLow = vec3(0.63, 0.79, 0.78);
  vec3 waterNear = vec3(0.025, 0.20, 0.21);
  vec3 waterFar = vec3(0.18, 0.43, 0.45);
  float overhead = smoothstep(0.74,0.82,uProgress) * (1.0 - smoothstep(0.955,0.995,uProgress));
  float horizonY = mix(0.47, 1.10, overhead);
  float horizon = smoothstep(horizonY - 0.04, horizonY + 0.04, uv.y);
  vec3 sky = mix(skyLow, skyTop, smoothstep(horizonY,1.0,uv.y));
  vec3 water = mix(waterNear, waterFar, smoothstep(0.0,horizonY,uv.y));
  vec3 color = mix(water, sky, horizon);

  float perspective = 1.0 / max(0.13, uv.y + 0.10);
  float waveA = sin(uv.x * 19.0 + perspective * 2.4 + uTime * 0.52);
  float waveB = sin(uv.x * -12.0 + perspective * 4.4 - uTime * 0.34);
  float waveC = sin(uv.x * 7.0 + perspective * 7.2 + uTime * 0.19);
  float ripple = (waveA + waveB * 0.56 + waveC * 0.24) / 1.8;
  float waterMask = 1.0 - smoothstep(horizonY - 0.02, horizonY + 0.13, uv.y);
  color += ripple * 0.018 * waterMask * mix(1.0,0.22,clamp(uv.y/max(horizonY,0.01),0.0,1.0));
  float glint = smoothstep(0.82,0.99,ripple * 0.5 + 0.5) * waterMask;
  color += glint * vec3(0.06,0.085,0.065);

  vec2 sunPos = vec2(0.67 + uPointer.x * 0.012, 0.78 + uPointer.y * 0.007);
  float sun = 1.0 - smoothstep(0.0,0.20,distance(uv,sunPos));
  color += sun * vec3(0.12,0.11,0.065) * (0.48 - uProgress * 0.08);
  float glow = exp(-pow((uv.y-horizonY)*15.0,2.0));
  color = mix(color,vec3(0.71,0.82,0.78),glow*0.18);
  float vignette = smoothstep(0.98,0.24,length(p));
  color *= 0.86 + vignette * 0.14;
  float grain = hash(floor(uv * vec2(520.0,300.0)) + floor(uTime*0.6)) - 0.5;
  color += grain * 0.006;
  gl_FragColor = vec4(color,1.0);
}`;

const PAD_VS = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aCenter;
attribute float aScale;
attribute float aRotation;
attribute vec2 aTilt;
attribute float aShade;
attribute float aPhase;
attribute float aOrder;
uniform mat4 uView;
uniform mat4 uViewProj;
uniform float uTime;
uniform float uReducedMotion;
uniform float uProgress;
uniform float uCoverage;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vShade;
varying float vFog;
varying float vEdge;
varying float vTop;
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.0,0.0,0.0,0.0,c,s,0.0,-s,c);}
mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.0,-s,c,0.0,0.0,0.0,1.0);}
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);}
void main(){
  float motion=1.0-uReducedMotion;
  mat3 rot=rotY(aRotation)*rotZ(aTilt.y)*rotX(aTilt.x);
  float answerMode=smoothstep(0.775,0.81,uProgress)*(1.0-smoothstep(0.945,0.975,uProgress));
  float answerScale=mix(1.0,1.62,answerMode);
  vec3 local=aPosition*aScale*answerScale;
  vec3 center=aCenter;
  center.y += sin(uTime*0.72+aPhase)*0.022*motion;
  center.x += sin(uTime*0.15+aPhase*1.7)*0.012*motion;
  float question = smoothstep(0.56,0.63,uProgress) * (1.0 - smoothstep(0.74,0.81,uProgress));
  center.x += question * 1.18;
  float revealMask=mix(1.0,step(aOrder,uCoverage+0.0005),answerMode);
  center.x += (1.0-revealMask)*1000.0;
  vec3 world=center+rot*local;
  vec4 viewPos=uView*vec4(world,1.0);
  gl_Position=uViewProj*vec4(world,1.0);
  vNormal=normalize(rot*aNormal);
  vWorld=world;
  vLocal=aPosition;
  vShade=aShade;
  vFog=clamp((-viewPos.z-4.0)/13.5,0.0,1.0);
  vEdge=clamp(-aPosition.y*22.0,0.0,1.0);
  vTop=smoothstep(0.35,0.85,aNormal.y);
}`;

const PAD_FS = `
precision highp float;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vShade;
varying float vFog;
varying float vEdge;
varying float vTop;
uniform vec3 uCameraPos;
uniform float uProgress;
void main(){
  vec3 N=normalize(vNormal);
  vec3 L=normalize(vec3(-0.38,0.86,0.38));
  vec3 V=normalize(uCameraPos-vWorld);
  vec3 H=normalize(L+V);
  float diffuse=max(dot(N,L),0.0);
  float spec=pow(max(dot(N,H),0.0),42.0);
  float rim=pow(1.0-max(dot(N,V),0.0),2.5);
  vec3 deep=vec3(0.035,0.13,0.045);
  vec3 leaf=vec3(0.12,0.35,0.085);
  vec3 young=vec3(0.34,0.55,0.18);
  vec3 base=mix(leaf,young,0.16+vShade*0.42);
  base=mix(deep,base,0.54+diffuse*0.58);

  // Subtle real-leaf structure rather than flat green plastic.
  float r=length(vLocal.xz);
  float a=atan(vLocal.z,vLocal.x);
  float radial=pow(max(0.0,1.0-abs(sin(a*7.0+vShade*2.2))),28.0)*smoothstep(0.18,0.95,r);
  float midrib=pow(max(0.0,1.0-abs(vLocal.z)*7.0),16.0)*smoothstep(0.08,0.95,vLocal.x);
  float centerShade=1.0-smoothstep(0.0,0.92,r);
  base += (radial*0.030 + midrib*0.045 + centerShade*0.018) * vTop * vec3(0.55,0.72,0.26);
  base *= mix(1.0,0.62,vEdge);
  base += spec*vec3(0.22,0.30,0.14);
  base += rim*0.035*vec3(0.30,0.48,0.22);
  vec3 fogColor=vec3(0.38,0.59,0.59);
  base=mix(base,fogColor,vFog*0.32);
  float outro=smoothstep(0.978,1.0,uProgress);
  base=mix(base,base*0.82,outro*0.32);
  gl_FragColor=vec4(base,0.99);
}`;

const SHADOW_VS = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aCenter;
attribute float aScale;
attribute float aRotation;
attribute vec2 aTilt;
attribute float aPhase;
attribute float aOrder;
uniform mat4 uViewProj;
uniform float uTime;
uniform float uReducedMotion;
uniform float uProgress;
uniform float uCoverage;
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);}
void main(){
  float motion=1.0-uReducedMotion;
  float answerMode=smoothstep(0.775,0.81,uProgress)*(1.0-smoothstep(0.945,0.975,uProgress));
  float answerScale=mix(1.0,1.62,answerMode);
  vec3 local=aPosition*aScale*1.06*answerScale;
  local=rotY(aRotation)*local;
  vec3 center=aCenter;
  center.y=-0.025;
  center.x += sin(uTime*0.15+aPhase*1.7)*0.012*motion;
  float question=smoothstep(0.56,0.63,uProgress)*(1.0-smoothstep(0.74,0.81,uProgress));
  center.x += question*1.18;
  float revealMask=mix(1.0,step(aOrder,uCoverage+0.0005),answerMode);
  center.x += (1.0-revealMask)*1000.0;
  vec3 world=center+vec3(local.x,-0.015,local.z);
  gl_Position=uViewProj*vec4(world,1.0);
}`;
const SHADOW_FS = `precision mediump float; void main(){ gl_FragColor=vec4(0.01,0.035,0.026,0.12); }`;

const MOTE_VS = `
precision highp float;
attribute vec3 aPosition;
attribute float aSize;
attribute float aPhase;
uniform mat4 uViewProj;
uniform float uTime;
uniform float uReducedMotion;
void main(){
  float motion=1.0-uReducedMotion;
  vec3 p=aPosition;
  p.x += sin(uTime*0.20+aPhase)*0.18*motion;
  p.y += sin(uTime*0.31+aPhase*1.9)*0.12*motion;
  vec4 clip=uViewProj*vec4(p,1.0);
  gl_Position=clip;
  gl_PointSize=aSize/max(1.3,clip.w)*8.0;
}`;
const MOTE_FS = `
precision mediump float;
void main(){ vec2 p=gl_PointCoord-0.5; float r=length(p); float alpha=1.0-smoothstep(0.0,0.5,r); gl_FragColor=vec4(0.94,0.93,0.66,alpha*0.18); }
`;

export class PondRenderer {
  constructor(canvas,{reducedMotion=false,forceUnavailable=false}={}) {
    this.canvas=canvas; this.reducedMotion=reducedMotion; this.forceUnavailable=forceUnavailable;
    this.gl=null; this.inst=null; this.ready=false; this.quality=null;
    this.state={progress:0,coverage:0,day:1}; this.pointer={x:0,y:0,tx:0,ty:0};
    this.start=performance.now(); this._raf=0;
    this._onPointer=(event)=>{ if(this.reducedMotion)return; this.pointer.tx=(event.clientX/Math.max(1,innerWidth)-0.5)*2; this.pointer.ty=(event.clientY/Math.max(1,innerHeight)-0.5)*2; };
  }

  init() {
    if (this.forceUnavailable) return false;
    const gl=this.canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,powerPreference:'high-performance',desynchronized:true}) || this.canvas.getContext('experimental-webgl');
    if(!gl) return false;
    const inst=gl.getExtension('ANGLE_instanced_arrays');
    if(!inst) return false;
    this.gl=gl; this.inst=inst; this.quality=chooseQuality();
    const padBindings={aPosition:0,aNormal:1,aCenter:2,aScale:3,aRotation:4,aTilt:5,aShade:6,aPhase:7,aOrder:8};
    this.bgProgram=makeProgram(gl,BG_VS,BG_FS,{aClip:0});
    this.padProgram=makeProgram(gl,PAD_VS,PAD_FS,padBindings);
    this.shadowProgram=makeProgram(gl,SHADOW_VS,SHADOW_FS,padBindings);
    this.moteProgram=makeProgram(gl,MOTE_VS,MOTE_FS,{aPosition:0,aSize:1,aPhase:2});

    this.bgBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.bgBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),gl.STATIC_DRAW);

    const geometry=makePadGeometry(); this.padVertexCount=geometry.length/6;
    this.padBuffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.padBuffer); gl.bufferData(gl.ARRAY_BUFFER,geometry,gl.STATIC_DRAW);
    const instances=makePadInstances(this.quality.pads);
    this.instanceBuffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.instanceBuffer); gl.bufferData(gl.ARRAY_BUFFER,instances,gl.STATIC_DRAW);

    const motes=makeMotes(this.quality.motes);
    this.moteBuffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.moteBuffer); gl.bufferData(gl.ARRAY_BUFFER,motes,gl.STATIC_DRAW);

    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.clearDepth(1); gl.depthFunc(gl.LEQUAL);
    this.ready=true; this.resize(); window.addEventListener('pointermove',this._onPointer,{passive:true}); this._loop(); return true;
  }

  setState(state){ this.state={progress:glClamp(state.progress??0,0,1),coverage:glClamp(state.coverage??0,0,1),day:state.day??1}; }
  resize(){ if(!this.ready)return; const gl=this.gl; const dpr=Math.min(devicePixelRatio||1,this.quality.dpr); const w=Math.max(1,Math.round(this.canvas.clientWidth*dpr)); const h=Math.max(1,Math.round(this.canvas.clientHeight*dpr)); if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;} gl.viewport(0,0,w,h); }

  _background(elapsed,px,py){
    const gl=this.gl; gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.useProgram(this.bgProgram); gl.bindBuffer(gl.ARRAY_BUFFER,this.bgBuffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); this.inst.vertexAttribDivisorANGLE(0,0);
    gl.uniform1f(gl.getUniformLocation(this.bgProgram,'uTime'),elapsed); gl.uniform1f(gl.getUniformLocation(this.bgProgram,'uProgress'),this.state.progress); gl.uniform2f(gl.getUniformLocation(this.bgProgram,'uPointer'),px,py);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }

  _bindPadAttributes(program){
    const gl=this.gl, inst=this.inst;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.padBuffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,6*4,0); inst.vertexAttribDivisorANGLE(0,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,6*4,3*4); inst.vertexAttribDivisorANGLE(1,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.instanceBuffer); const stride=10*4;
    const attrs=[[2,3,0],[3,1,3],[4,1,4],[5,2,5],[6,1,7],[7,1,8],[8,1,9]];
    attrs.forEach(([loc,size,off])=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,off*4);inst.vertexAttribDivisorANGLE(loc,1);});
  }

  _drawPads(elapsed,view,viewProj,camera,visiblePads){
    const gl=this.gl, inst=this.inst;
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.depthMask(false); gl.useProgram(this.shadowProgram); this._bindPadAttributes(this.shadowProgram);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.shadowProgram,'uViewProj'),false,viewProj); gl.uniform1f(gl.getUniformLocation(this.shadowProgram,'uTime'),elapsed); gl.uniform1f(gl.getUniformLocation(this.shadowProgram,'uReducedMotion'),this.reducedMotion?1:0); gl.uniform1f(gl.getUniformLocation(this.shadowProgram,'uProgress'),this.state.progress); gl.uniform1f(gl.getUniformLocation(this.shadowProgram,'uCoverage'),this.state.coverage);
    inst.drawArraysInstancedANGLE(gl.TRIANGLES,0,this.padVertexCount,visiblePads);

    gl.depthMask(true); gl.useProgram(this.padProgram); this._bindPadAttributes(this.padProgram);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.padProgram,'uView'),false,view); gl.uniformMatrix4fv(gl.getUniformLocation(this.padProgram,'uViewProj'),false,viewProj); gl.uniform1f(gl.getUniformLocation(this.padProgram,'uTime'),elapsed); gl.uniform1f(gl.getUniformLocation(this.padProgram,'uReducedMotion'),this.reducedMotion?1:0); gl.uniform1f(gl.getUniformLocation(this.padProgram,'uProgress'),this.state.progress); gl.uniform1f(gl.getUniformLocation(this.padProgram,'uCoverage'),this.state.coverage); gl.uniform3f(gl.getUniformLocation(this.padProgram,'uCameraPos'),camera.eye[0],camera.eye[1],camera.eye[2]);
    inst.drawArraysInstancedANGLE(gl.TRIANGLES,0,this.padVertexCount,visiblePads);
  }

  _drawMotes(elapsed,viewProj){
    const gl=this.gl; gl.depthMask(false); gl.useProgram(this.moteProgram); gl.bindBuffer(gl.ARRAY_BUFFER,this.moteBuffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,5*4,0); this.inst.vertexAttribDivisorANGLE(0,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,1,gl.FLOAT,false,5*4,3*4); this.inst.vertexAttribDivisorANGLE(1,0);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,1,gl.FLOAT,false,5*4,4*4); this.inst.vertexAttribDivisorANGLE(2,0);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.moteProgram,'uViewProj'),false,viewProj); gl.uniform1f(gl.getUniformLocation(this.moteProgram,'uTime'),elapsed); gl.uniform1f(gl.getUniformLocation(this.moteProgram,'uReducedMotion'),this.reducedMotion?1:0);
    gl.drawArrays(gl.POINTS,0,this.quality.motes); gl.depthMask(true);
  }

  render(now=performance.now()){
    if(!this.ready)return; const elapsed=this.reducedMotion?0:(now-this.start)/1000;
    this.pointer.x=lerp(this.pointer.x,this.pointer.tx,0.035); this.pointer.y=lerp(this.pointer.y,this.pointer.ty,0.035);
    const px=this.reducedMotion?0:this.pointer.x, py=this.reducedMotion?0:this.pointer.y;
    const aspect=Math.max(0.65,this.canvas.width/Math.max(1,this.canvas.height));
    this._background(elapsed,px,py);
    const camera=cameraForProgress(this.state.progress,this.pointer,this.reducedMotion); const view=mat4LookAt(camera.eye,camera.target); const projection=mat4Perspective(camera.fov*Math.PI/180,aspect,0.1,40); const viewProj=mat4Multiply(projection,view);
    const visiblePads=visualPadCount(this.state.day,this.state.coverage,this.quality.pads);
    const drawPads=this.state.progress>=0.775&&this.state.progress<=0.975?this.quality.pads:visiblePads;
    this._drawPads(elapsed,view,viewProj,camera,drawPads); this._drawMotes(elapsed,viewProj);

  }
  _loop=(now)=>{if(!this.ready)return;this.resize();this.render(now);this._raf=requestAnimationFrame(this._loop);};
  destroy(){this.ready=false;cancelAnimationFrame(this._raf);window.removeEventListener('pointermove',this._onPointer);}
}

export function createPondRenderer(canvas,options={}){
  const renderer=new PondRenderer(canvas,options);
  try{return renderer.init()?renderer:null;}catch(error){console.error('[pond] WebGL renderer failed:',error);renderer.destroy();return null;}
}

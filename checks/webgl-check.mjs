import fs from 'node:fs';
const src=fs.readFileSync('src/webgl.js','utf8');
const water=process.argv.includes('--water');
function assert(ok,msg){if(!ok){console.error(msg);process.exit(1);}}
if(water){
  assert(src.includes('BG_FS') && src.includes('aClip'), 'fullscreen procedural background shader missing');
  assert(!/waterPlane|PlaneGeometry|drawWaterPlane|finite water/i.test(src), 'finite water plane implementation detected');
  assert(src.includes('horizonY') && src.includes('ripple'), 'procedural water/horizon logic missing');
  console.log('water boundary verification passed');
}else{
  assert(src.includes('mat4Perspective') && src.includes('mat4LookAt'), 'perspective camera matrices missing');
  assert(src.includes("getContext('webgl'") && src.includes('ANGLE_instanced_arrays'), 'actual WebGL renderer/instancing missing');
  assert(src.includes('makePadGeometry') && src.includes('aNormal') && src.includes('vLocal'), '3D pad geometry or normals missing');
  assert(src.includes('gl.enable(gl.DEPTH_TEST)') && src.includes('drawArraysInstancedANGLE'), 'depth-tested instanced 3D draw missing');
  assert(src.includes('spec=pow') && src.includes('radial=pow') && src.includes('midrib=pow'), 'lighting or organic leaf detail missing');
  assert(src.includes('CAMERA_KEYS') && src.includes('uProgress'), 'scroll-driven camera travel missing');
  console.log('webgl 3d verification passed');
}

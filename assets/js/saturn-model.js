import {
  Group, Mesh, SphereGeometry, RingGeometry, ShaderMaterial,
  TextureLoader, Vector3, Quaternion, SRGBColorSpace, RepeatWrapping,
  ClampToEdgeWrapping, DoubleSide, BackSide, AdditiveBlending
} from 'three';

const vertexShader = [
  'varying vec2 vUv;',
  'varying vec3 vLocalPosition;',
  'varying vec3 vLocalNormal;',
  'void main() {',
  ' vUv = uv;',
  ' vLocalPosition = position;',
  ' vLocalNormal = normal;',
  ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

const sharedFragment = [
  'uniform vec3 uLight;',
  'uniform vec3 uCamera;',
  'uniform float uIntensity;',
  'varying vec2 vUv;',
  'varying vec3 vLocalPosition;',
  'varying vec3 vLocalNormal;',
  'float ringCoordinate(float radius) { return clamp((radius - 1.18) / 1.18, 0.0, 1.0); }'
].join('\n');

const planetFragment = sharedFragment + '\n' + [
  'uniform sampler2D uSurface;',
  'uniform sampler2D uRings;',
  'uniform float uRotation;',
  'void main() {',
  ' vec3 normal = normalize(vLocalNormal);',
  ' vec3 view = normalize(uCamera - vLocalPosition);',
  ' vec3 albedo = texture2D(uSurface, vec2(vUv.x + uRotation, vUv.y)).rgb;',
  ' float facing = max(dot(normal, view), 0.0);',
  // Limb darkening of a gas giant: the disk dims toward its edge.
  ' albedo *= mix(0.62, 1.0, pow(facing, 0.38));',
  ' float direct = max(dot(normal, uLight), 0.0);',
  ' float shadow = 1.0;',
  ' if (abs(uLight.y) > 0.02) {',
  '   float distanceToPlane = -vLocalPosition.y / uLight.y;',
  '   vec3 hit = vLocalPosition + uLight * distanceToPlane;',
  '   float radius = length(hit.xz);',
  '   float coordinate = (radius - 1.18) / 1.18;',
  '   vec2 gradientX = vec2(dFdx(coordinate), 0.0);',
  '   vec2 gradientY = vec2(dFdy(coordinate), 0.0);',
  '   float footprint = max(abs(gradientX.x) + abs(gradientY.x), 1.0 / 2048.0);',
  '   if (distanceToPlane > 0.0 && coordinate > 0.0 && coordinate < 1.0) {',
  '     float density = textureGrad(uRings, vec2(coordinate, 0.5), gradientX * 1.5, gradientY * 1.5).a;',
  '     float coverage = smoothstep(0.0, footprint, coordinate) * (1.0 - smoothstep(1.0 - footprint, 1.0, coordinate));',
  '     shadow = 1.0 - density * coverage * smoothstep(0.0, 0.012, distanceToPlane) * 0.79;',
  '   }',
  ' }',
  ' vec3 ambient = vec3(0.075, 0.083, 0.1);',
  ' vec3 sunlight = vec3(1.25, 1.17, 1.02) * pow(direct, 0.92) * shadow;',
  ' float rim = 1.0 - facing;',
  ' float limb = rim * rim * rim;',
  ' vec3 scattering = vec3(0.13, 0.12, 0.095) * limb * smoothstep(-0.15, 0.75, dot(normal, uLight));',
  ' vec3 color = (albedo * (ambient + sunlight) + scattering) * uIntensity;',
  ' gl_FragColor = vec4(color, 1.0);',
  ' #include <tonemapping_fragment>',
  ' #include <colorspace_fragment>',
  '}'
].join('\n');

const ringFragment = sharedFragment + '\n' + [
  'uniform sampler2D uRings;',
  'void main() {',
  ' float radius = length(vLocalPosition.xz);',
  ' float coordinate = ringCoordinate(radius);',
  // Explicit radial derivatives filter thin bands; the edges fade over one pixel.
  ' float dx = dFdx(radius), dy = dFdy(radius);',
  ' float pixel = max(abs(dx) + abs(dy), 1e-5);',
  ' vec4 band = textureGrad(uRings, vec2(coordinate, 0.5), vec2(dx / 1.18 * 1.25, 0.0), vec2(dy / 1.18 * 1.25, 0.0));',
  ' band.a *= smoothstep(1.18, 1.18 + pixel * 1.5, radius) * (1.0 - smoothstep(2.36 - pixel * 1.5, 2.36, radius));',
  ' if (band.a <= 0.002) discard;',
  ' vec3 rayOrigin = vLocalPosition / vec3(1.0, 0.9, 1.0);',
  ' vec3 rayDirection = uLight / vec3(1.0, 0.9, 1.0);',
  ' float closest = max(0.0, -dot(rayOrigin, rayDirection) / dot(rayDirection, rayDirection));',
  ' float distanceToBody = length(rayOrigin + rayDirection * closest);',
  ' float lightThrough = closest > 0.001 ? smoothstep(0.985, 1.035, distanceToBody) : 1.0;',
  ' float planeLight = 0.5 + 0.5 * abs(uLight.y);',
  // Seen from the unlit face, sparse ring regions glow and dense ones darken.
  ' float litFace = step(0.0, uLight.y * (uCamera.y - vLocalPosition.y));',
  ' float transmission = mix(0.45 + 0.55 * (1.0 - band.a), 1.0, litFace);',
  ' vec3 color = band.rgb * (0.10 + vec3(1.12, 1.06, 0.95) * planeLight * lightThrough * transmission) * uIntensity;',
  ' gl_FragColor = vec4(color, band.a);',
  ' #include <tonemapping_fragment>',
  ' #include <colorspace_fragment>',
  '}'
].join('\n');

const atmosphereFragment = sharedFragment + '\n' + [
  'void main() {',
  ' vec3 normal = normalize(vLocalNormal);',
  ' vec3 view = normalize(uCamera - vLocalPosition);',
  ' float edge = pow(1.0 - abs(dot(normal, view)), 2.8);',
  ' float lit = smoothstep(-0.25, 0.8, dot(normal, uLight));',
  ' gl_FragColor = vec4(vec3(0.43, 0.40, 0.31) * uIntensity, edge * lit * 0.12);',
  ' #include <tonemapping_fragment>',
  ' #include <colorspace_fragment>',
  '}'
].join('\n');

export async function createSaturnModel({ surfaceUrl, ringUrl, compact = false }) {
  const loader = new TextureLoader();
  const loaded = await Promise.allSettled([loader.loadAsync(surfaceUrl), loader.loadAsync(ringUrl)]);
  if (loaded.some(result => result.status === 'rejected')) {
    loaded.forEach(result => { if (result.status === 'fulfilled') result.value.dispose(); });
    throw new Error('Saturn materials unavailable');
  }
  const textures = loaded.map(result => result.value);
  const [surface, rings] = textures;
  for (const texture of textures) {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapT = ClampToEdgeWrapping;
    texture.anisotropy = compact ? 4 : 8;
  }
  surface.wrapS = RepeatWrapping;
  rings.wrapS = ClampToEdgeWrapping;
  // The ring lookup is one-dimensional; isotropic mip filtering avoids
  // sharpening subpixel bands on the far side of the annulus.
  rings.anisotropy = 1;
  const group = new Group();
  group.name = 'Saturn';
  const shared = {
    uLight: { value: new Vector3(-3, 5, 7).normalize() },
    uCamera: { value: new Vector3(0, 0, 8) },
    uIntensity: { value: 1 }
  };
  const uniforms = { ...shared, uSurface: { value: surface }, uRings: { value: rings }, uRotation: { value: 0 } };
  const globeGeometry = new SphereGeometry(1, compact ? 112 : 192, compact ? 72 : 128);
  globeGeometry.scale(1, 0.9, 1);
  const globe = new Mesh(globeGeometry, new ShaderMaterial({ vertexShader, fragmentShader: planetFragment, uniforms }));
  globe.name = 'Saturn body';
  group.add(globe);
  const ringGeometry = new RingGeometry(1.18, 2.36, compact ? 320 : 640, 1);
  ringGeometry.rotateX(-Math.PI / 2);
  const ring = new Mesh(ringGeometry, new ShaderMaterial({
    vertexShader, fragmentShader: ringFragment, uniforms,
    side: DoubleSide, transparent: true, depthWrite: false
  }));
  ring.renderOrder = 2;
  ring.name = 'Saturn rings';
  group.add(ring);
  const atmosphereGeometry = new SphereGeometry(1.014, compact ? 96 : 160, compact ? 64 : 96);
  atmosphereGeometry.scale(1, 0.9, 1);
  const atmosphere = new Mesh(atmosphereGeometry, new ShaderMaterial({
    vertexShader, fragmentShader: atmosphereFragment, uniforms: shared,
    side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending
  }));
  atmosphere.renderOrder = 3;
  atmosphere.name = 'Saturn atmosphere';
  group.add(atmosphere);
  const inverse = new Quaternion();
  const sun = new Vector3(-3, 5, 7).normalize();
  const cameraPosition = new Vector3();
  const groupPosition = new Vector3();
  function update(camera, intensity = 1, seconds = 0) {
    group.updateMatrixWorld(true);
    group.getWorldQuaternion(inverse).invert();
    shared.uLight.value.copy(sun).applyQuaternion(inverse);
    camera.getWorldPosition(cameraPosition);
    group.getWorldPosition(groupPosition);
    shared.uCamera.value.copy(cameraPosition).sub(groupPosition).applyQuaternion(inverse).divideScalar(group.scale.x);
    shared.uIntensity.value = intensity;
    // An axisymmetric globe can rotate its atmosphere without rotating sunlight.
    uniforms.uRotation.value = (seconds * 0.008) % 1;
  }
  function dispose() {
    for (const mesh of [globe, ring, atmosphere]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    textures.forEach(texture => texture.dispose());
  }
  return { group, update, dispose };
}

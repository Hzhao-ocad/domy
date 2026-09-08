'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createMiniAttachments } from '@/lib/dome';
import { defaults } from '@/lib/defaults';
import { activateDome, advanceLighting, createLightingState } from '@/lib/lighting';
import { setPaletteColor } from '@/lib/palette';
import { nearestPointIndex, offsetControlPoints } from '@/lib/path';
import { pathGuideVisibility } from '@/lib/path-guides';
import { pedestrianHeightForDomeRadius } from '@/lib/pedestrian';
import { mergePreset } from '@/lib/preset';
import { serializePreset } from '@/lib/preset-export';
import { selectColorPointLights } from '@/lib/scene-lighting';

type Params = typeof defaults;
const domeEmission = .34;
type Dome = { group: THREE.Group; material: THREE.ShaderMaterial; minis: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[]; attachments: ReturnType<typeof createMiniAttachments>; points: { phase: THREE.Vector3; color: THREE.Color; position: THREE.Vector3 }[]; markers: THREE.Mesh[]; display: number };

const random = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const bulbGeometry = (radius: number, cut: number) => { const g = new THREE.SphereGeometry(radius, 96, 48, 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(cut)); g.rotateX(Math.PI / 2); g.translate(0, 0, -radius * Math.cos(THREE.MathUtils.degToRad(cut))); return g; };
const pathRoadGeometry = (curve: THREE.Curve<THREE.Vector3>, width: number) => {
  const points = curve.getSpacedPoints(180), vertices: number[] = [], indices: number[] = [];
  points.forEach((point, index) => {
    const tangent = curve.getTangentAt(index / (points.length - 1));
    const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize().multiplyScalar(width / 2);
    vertices.push(point.x - side.x, point.y - side.y, .015, point.x + side.x, point.y + side.y, .015);
  });
  for (let index = 0; index < points.length - 1; index++) indices.push(index * 2, index * 2 + 2, index * 2 + 1, index * 2 + 1, index * 2 + 2, index * 2 + 3);
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)).setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};
const material = () => new THREE.ShaderMaterial({
  uniforms: { p: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) }, c: { value: Array.from({ length: 8 }, () => new THREE.Color()) }, n: { value: 4 }, brightness: { value: 0 }, influence: { value: .8 }, blend: { value: 2 }, saturation: { value: 1 }, emission: { value: 1 }, skyLight: { value: .08 }, moonlight: { value: .1 }, opacity: { value: 1 } },
  vertexShader: 'varying vec3 v; varying vec3 no; void main(){v=position;no=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 p[8];uniform vec3 c[8];uniform int n;uniform float brightness,influence,blend,saturation,emission,skyLight,moonlight,opacity;varying vec3 v;varying vec3 no;void main(){vec3 f=vec3(0.);float total=0.;for(int i=0;i<8;i++){if(i>=n)break;float w=exp(-pow(length(v-p[i])/max(influence,.01),blend));f+=c[i]*w;total+=w;}f/=max(total,.001);f=mix(vec3(dot(f,vec3(.2126,.7152,.0722))),f,saturation);float colorAmount=clamp(brightness,0.,1.);vec3 base=mix(vec3(.72),f,colorAmount);float light=skyLight+moonlight*max(dot(no,normalize(vec3(-.4,.3,.9))),0.);gl_FragColor=vec4(base*light+f*colorAmount*emission*${domeEmission},opacity);}`,
});

const miniMaterial = () => new THREE.ShaderMaterial({
  uniforms: { base: { value: new THREE.Color(.72, .72, .72) }, field: { value: new THREE.Color() }, brightness: { value: 0 }, emission: { value: 1 }, skyLight: { value: .08 }, moonlight: { value: .1 } },
  vertexShader: 'varying vec3 no;void main(){no=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 base,field;uniform float brightness,emission,skyLight,moonlight;varying vec3 no;void main(){float colorAmount=clamp(brightness,0.,1.);vec3 surface=mix(base,field,colorAmount);float light=skyLight+moonlight*max(dot(no,normalize(vec3(-.4,.3,.9))),0.);gl_FragColor=vec4(surface*light+field*colorAmount*emission*${domeEmission},1.);}`,
});

function Slider({ label, value, min, max, step, unit = '', set }: { label: string; value: number; min: number; max: number; step: number; unit?: string; set: (n: number) => void }) {
  return <label className="control"><span>{label}</span><b>{Number(value.toFixed(2))}{unit}</b><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} /></label>;
}

export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const api = useRef<{ rebuild: () => void; refreshPath: () => void; reset: () => void } | null>(null);
  const values = useRef<Params>(defaults);
  const [params, setParams] = useState<Params>(defaults);
  const [open, setOpen] = useState(true);
  const skipFirstPresetSave = useRef(true);
  const set = <K extends keyof Params>(key: K, value: Params[K]) => setParams((p) => ({ ...p, [key]: value }));
  useEffect(() => { values.current = params; }, [params]);
  useEffect(() => {
    const saved = localStorage.getItem('domy-preset');
    if (saved) setParams(mergePreset(defaults, JSON.parse(saved)));
  }, []);
  useEffect(() => {
    if (skipFirstPresetSave.current) {
      skipFirstPresetSave.current = false;
      return;
    }
    localStorage.setItem('domy-preset', JSON.stringify(params));
  }, [params]);
  const savePreset = () => localStorage.setItem('domy-preset', JSON.stringify(params));
  const exportPreset = () => {
    const file = new Blob([serializePreset(params)], { type: 'application/json' });
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = 'domy-preset.json'; link.click(); URL.revokeObjectURL(url);
  };
  const loadPreset = () => {
    const saved = localStorage.getItem('domy-preset');
    if (saved) setParams(mergePreset(defaults, JSON.parse(saved)));
  };

  useEffect(() => {
    const host = mount.current!;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#101522');
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, .1, 500); camera.up.set(0, 0, 1); camera.position.set(10, -17, 14);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; host.appendChild(renderer.domElement);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), .35, .4, .85); composer.addPass(bloom);
    const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.target.set(0, 0, .6); orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    const skyLight = new THREE.HemisphereLight('#9aa9d0', '#061109', values.current.skyLight); const moon = new THREE.DirectionalLight('#c7d2f5', values.current.moonlight); moon.position.set(-7, -10, 16); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -20; moon.shadow.camera.right = 20; moon.shadow.camera.top = 20; moon.shadow.camera.bottom = -20; scene.add(skyLight, moon, moon.target);
    const groundGeometry = new THREE.PlaneGeometry(60, 60, 48, 48), grassColors = new Float32Array(groundGeometry.attributes.position.count * 3), grassRandom = random(406);
    for (let i = 0; i < grassColors.length; i += 3) { const shade = .74 + grassRandom() * .26; grassColors[i] = .21 * shade; grassColors[i + 1] = .43 * shade; grassColors[i + 2] = .16 * shade; }
    groundGeometry.setAttribute('color', new THREE.BufferAttribute(grassColors, 3));
    const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; scene.add(ground);

    const controls = values.current.controlPoints.map((point) => new THREE.Vector3(point.x, point.y, 0));
    const pedestrianControls = offsetControlPoints(values.current.controlPoints, values.current.pedestrianOffset).map((point) => new THREE.Vector3(point.x, point.y, .03));
    const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
    const pedestrianCurve = new THREE.CatmullRomCurve3(pedestrianControls, false, 'centripetal');
    const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 180, values.current.pathWidth / 2, 16, false), new THREE.MeshBasicMaterial({ color: '#c9d2ca', transparent: true, opacity: .45 })); scene.add(path);
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#7f9083' })); scene.add(line);
    const pedestrianRoad = new THREE.Mesh(pathRoadGeometry(pedestrianCurve, values.current.pedestrianPathWidth), new THREE.MeshStandardMaterial({ color: '#777b78', roughness: 1 })); pedestrianRoad.receiveShadow = true; scene.add(pedestrianRoad);
    const pedestrianLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#d2c6a8' })); scene.add(pedestrianLine);
    const handles = controls.map((point, index) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(.18, 20, 14), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#81b493', emissiveIntensity: .5 })); mesh.position.copy(point).setZ(.13); mesh.userData.index = index; scene.add(mesh); return mesh; });
    const gravel = new THREE.Group(), stoneGeometry = new THREE.DodecahedronGeometry(.11, 0), stoneMaterial = new THREE.MeshStandardMaterial({ color: '#c4bba5', roughness: 1 }); scene.add(gravel);
    const pedestrian = new THREE.Group(), shirt = new THREE.MeshStandardMaterial({ color: '#3f6470', roughness: .8 }), trousers = new THREE.MeshStandardMaterial({ color: '#263943', roughness: .9 }), skin = new THREE.MeshStandardMaterial({ color: '#d9a07b', roughness: .9 });
    const verticalCapsule = new THREE.CapsuleGeometry(.14, .36, 4, 8), verticalCylinder = new THREE.CylinderGeometry(.055, .065, .4, 8), armCylinder = new THREE.CylinderGeometry(.045, .055, .48, 8); verticalCapsule.rotateX(Math.PI / 2); verticalCylinder.rotateX(Math.PI / 2); armCylinder.rotateX(Math.PI / 2);
    const torso = new THREE.Mesh(verticalCapsule, shirt), head = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), skin), neck = new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .1, 8), skin), leftLeg = new THREE.Mesh(verticalCylinder, trousers), rightLeg = leftLeg.clone(), leftArm = new THREE.Mesh(armCylinder, shirt), rightArm = leftArm.clone();
    torso.position.z = .68; head.position.z = 1.18; neck.position.z = 1.01; neck.rotation.x = Math.PI / 2; leftLeg.position.set(-.09, 0, .2); rightLeg.position.set(.09, 0, .2); leftArm.position.set(-.23, 0, .69); rightArm.position.set(.23, 0, .69); leftArm.rotation.y = .35; rightArm.rotation.y = -.35; pedestrian.add(torso, head, neck, leftLeg, rightLeg, leftArm, rightArm); pedestrian.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } }); scene.add(pedestrian);
    const pedestrianBaseHeight = 1.32;
    const root = new THREE.Group(), colorPointLights: THREE.PointLight[] = []; scene.add(root); const refreshColorPointLights = () => { colorPointLights.forEach((light) => scene.remove(light)); colorPointLights.length = 0; Array.from({ length: values.current.count * values.current.pointLightsPerDome }, () => { const light = new THREE.PointLight('#fff', 0, values.current.pointLightRange, 2); scene.add(light); colorPointLights.push(light); }); }; const domes: Dome[] = [];
    let lighting = createLightingState(values.current.count, { propagationDelay: values.current.delay, propagationFactor: values.current.factor, decayInterval: values.current.decayStep, decayAmount: values.current.decay });
    let pedestrianIndex = 0, active: number | null = null;

    const positionDomes = () => domes.forEach((d, i) => d.group.position.copy(curve.getPointAt(domes.length === 1 ? .5 : i / (domes.length - 1))));
    const pedestrianSamples = () => pedestrianCurve.getSpacedPoints(Math.max(values.current.pedestrianPointCount - 1, 1));
    const positionPedestrian = (index: number) => {
      const samples = pedestrianSamples(); pedestrianIndex = Math.min(index, samples.length - 1);
      const progress = samples.length === 1 ? 0 : pedestrianIndex / (samples.length - 1), point = samples[pedestrianIndex], tangent = pedestrianCurve.getTangentAt(progress);
      pedestrian.position.copy(point).setZ(.02); pedestrian.rotation.z = Math.atan2(tangent.y, tangent.x) - Math.PI / 2;
      const trigger = curve.getPointAt(progress), next = domes.reduce((best, dome, domeIndex) => dome.group.position.distanceToSquared(trigger) < domes[best].group.position.distanceToSquared(trigger) ? domeIndex : best, 0);
      if (next !== active) { lighting = activateDome(lighting, next, performance.now()); active = next; }
    };
    const refreshGravel = () => {
      const samples = pedestrianSamples(), rng = random(812); gravel.clear(); pedestrianLine.geometry.dispose(); pedestrianLine.geometry = new THREE.BufferGeometry().setFromPoints(samples.map((point) => point.clone().setZ(.09)));
      samples.forEach((point) => Array.from({ length: 3 }, () => { const stone = new THREE.Mesh(stoneGeometry, stoneMaterial); stone.position.set(point.x + (rng() - .5) * values.current.pedestrianPathWidth * .7, point.y + (rng() - .5) * .35, .1); stone.scale.set(.45 + rng() * .8, .3 + rng() * .45, .25); stone.rotation.set(rng(), rng(), rng()); stone.castShadow = true; stone.receiveShadow = true; gravel.add(stone); }));
    };
    const refreshPath = () => {
      controls.forEach((point, index) => point.set(values.current.controlPoints[index].x, values.current.controlPoints[index].y, 0));
      offsetControlPoints(values.current.controlPoints, values.current.pedestrianOffset).forEach((point, index) => pedestrianControls[index].set(point.x, point.y, .03));
      curve.updateArcLengths(); pedestrianCurve.updateArcLengths();
      path.geometry.dispose(); path.geometry = new THREE.TubeGeometry(curve, 180, values.current.pathWidth / 2, 16, false); line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(180).map((point) => point.setZ(.02)));
      pedestrianRoad.geometry.dispose(); pedestrianRoad.geometry = pathRoadGeometry(pedestrianCurve, values.current.pedestrianPathWidth);
      handles.forEach((handle, index) => handle.position.copy(controls[index]).setZ(.13)); positionDomes(); refreshGravel(); positionPedestrian(pedestrianIndex);
    };
    const rebuild = () => {
      domes.forEach((d) => { d.material.dispose(); d.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }); root.clear(); domes.length = 0;
      for (let i = 0; i < values.current.count; i++) {
        const v = values.current, rng = random(Date.now() + i * 931), group = new THREE.Group(), mat = material(), main = new THREE.Mesh(bulbGeometry(v.radius, v.cut), mat); main.castShadow = true; group.add(main);
        const points = Array.from({ length: v.points }, () => ({ phase: new THREE.Vector3(rng() * 6.28, rng() * 6.28, rng() * 6.28), color: new THREE.Color(v.palette[Math.floor(rng() * v.palette.length)]), position: new THREE.Vector3() }));
        const attachments = createMiniAttachments({ count: v.miniMin + Math.floor(rng() * (v.miniMax - v.miniMin + 1)), domeRadius: v.radius, cutAngle: THREE.MathUtils.degToRad(v.cut), minRadius: v.radius * v.miniScaleMin, maxRadius: v.radius * v.miniScaleMax, random: rng });
        const minis = attachments.map((a) => { const mini = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), miniMaterial()); mini.castShadow = true; mini.receiveShadow = true; mini.scale.setScalar(a.radius); mini.position.copy(a.position); mini.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.normal); group.add(mini); return mini; });
        const markers = points.map(() => { const marker = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), new THREE.MeshBasicMaterial()); group.add(marker); return marker; });
        root.add(group); domes.push({ group, material: mat, minis, attachments, points, markers, display: 0 });
      }
      refreshColorPointLights(); pedestrian.scale.setScalar(pedestrianHeightForDomeRadius(values.current.radius) / pedestrianBaseHeight); positionDomes(); lighting = createLightingState(domes.length, { propagationDelay: values.current.delay, propagationFactor: values.current.factor, decayInterval: values.current.decayStep, decayAmount: values.current.decay }); active = null; positionPedestrian(pedestrianIndex);
    };
    rebuild(); refreshPath(); api.current = { rebuild, refreshPath, reset: () => { camera.position.set(10, -17, 14); orbit.target.set(0, 0, .6); orbit.update(); } };

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); let dragging: number | null = null, orbiting = false;
    const groundPoint = (e: PointerEvent) => { const box = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - box.left) / box.width * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1); ray.setFromCamera(pointer, camera); return ray.ray.intersectPlane(plane, new THREE.Vector3()); };
    const hover = (e: PointerEvent) => { if (dragging !== null || orbiting) return; const point = groundPoint(e); if (!point) return; const samples = pedestrianSamples(); positionPedestrian(nearestPointIndex(samples.map((sample) => ({ x: sample.x, y: sample.y })), { x: point.x, y: point.y })); };
    const down = (e: PointerEvent) => { const p = groundPoint(e); if (!p) return; const hit = ray.intersectObjects(handles)[0]; if (hit && values.current.showHandles) { dragging = hit.object.userData.index; orbit.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); } else orbiting = true; };
    const move = (e: PointerEvent) => { if (dragging !== null) { const point = groundPoint(e); if (point) setParams((params) => ({ ...params, controlPoints: params.controlPoints.map((control, index) => index === dragging ? { x: point.x, y: point.y } : control) })); } else hover(e); };
    const up = (e: PointerEvent) => { dragging = null; orbiting = false; orbit.enabled = true; if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId); hover(e); };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up);
    const resize = () => { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); composer.setSize(host.clientWidth, host.clientHeight); }; window.addEventListener('resize', resize);
    let last = performance.now(), frame = 0;
    const draw = (now: number) => { frame = requestAnimationFrame(draw); const v = values.current, palette = v.palette, dt = Math.min((now - last) / 1000, .05); last = now; lighting.options = { propagationDelay: v.delay, propagationFactor: v.factor, decayInterval: v.decayStep, decayAmount: v.decay }; if (!v.paused) lighting = advanceLighting(lighting, now); bloom.strength = v.bloom; moon.intensity = v.moonlight; skyLight.intensity = v.skyLight; const guides = pathGuideVisibility(v.showCollisionStrip, v.showPedestrianPath); path.visible = guides.domePath; line.visible = guides.domePath; pedestrianLine.visible = guides.pedestrianPath; handles.forEach((h) => h.visible = v.showHandles);
      const assignments = selectColorPointLights(domes.map((dome) => ({ brightness: dome.display, colors: dome.points.map((point) => point.color) })), v.pointLightsPerDome, v.pointLightIntensity); colorPointLights.forEach((light, index) => { const assignment = assignments[index]; if (!assignment) { light.intensity = 0; return; } const dome = domes[assignment.domeIndex], point = dome.points[assignment.pointIndex]; light.position.copy(dome.group.position).add(point.position); light.color.setRGB(assignment.color.r, assignment.color.g, assignment.color.b); light.distance = v.pointLightRange; light.intensity = assignment.intensity; });
      domes.forEach((d, i) => { d.display += ((lighting.brightness[i] || 0) - d.display) * Math.min(dt * 12, 1); const u = d.material.uniforms; u.brightness.value = d.display; u.n.value = d.points.length; u.influence.value = v.influence * v.radius; u.blend.value = v.blend; u.saturation.value = v.saturation; u.emission.value = v.emission; u.skyLight.value = v.skyLight; u.moonlight.value = v.moonlight; u.opacity.value = v.showPoints ? .78 : 1;
        d.points.forEach((point, j) => { if (!v.paused) { const t = now * .001 * v.roam; point.position.set(Math.sin(t * 1.1 + point.phase.x) * v.radius * .38, Math.cos(t * .87 + point.phase.y) * v.radius * .38, v.radius * .8 + Math.sin(t * 1.27 + point.phase.z) * v.radius * .28); const a = Math.floor((t + point.phase.x) / v.colorSpeed) % palette.length, b = (a + 1) % palette.length; point.color.lerpColors(new THREE.Color(palette[a]), new THREE.Color(palette[b]), ((t + point.phase.x) / v.colorSpeed) % 1); } u.p.value[j].copy(point.position); u.c.value[j].copy(point.color); d.markers[j].position.copy(point.position); d.markers[j].visible = v.showPoints; (d.markers[j].material as THREE.MeshBasicMaterial).color.copy(point.color); });
        d.minis.forEach((mini, j) => { const attachment = d.attachments[j]; const field = new THREE.Color(0, 0, 0); let total = 0; d.points.forEach((point) => { const weight = Math.exp(-Math.pow(point.position.distanceTo(attachment.position) / Math.max(v.influence * v.radius, .01), v.blend)); field.r += point.color.r * weight; field.g += point.color.g * weight; field.b += point.color.b * weight; total += weight; }); field.multiplyScalar(1 / total); const luma = field.r * .2126 + field.g * .7152 + field.b * .0722; field.lerp(new THREE.Color(luma, luma, luma), 1 - v.saturation); const uniforms = mini.material.uniforms; uniforms.field.value.copy(field); uniforms.brightness.value = d.display; uniforms.emission.value = v.emission; uniforms.skyLight.value = v.skyLight; uniforms.moonlight.value = v.moonlight; }); }); orbit.update(); composer.render(); };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); groundGeometry.dispose(); stoneGeometry.dispose(); stoneMaterial.dispose(); renderer.dispose(); host.removeChild(renderer.domElement); };
  }, []);
  useEffect(() => { api.current?.rebuild(); }, [params.count, params.radius, params.cut, params.miniMin, params.miniMax, params.miniScaleMin, params.miniScaleMax, params.points, params.pointLightsPerDome]);
  useEffect(() => { api.current?.refreshPath(); }, [params.controlPoints, params.pathWidth, params.pedestrianOffset, params.pedestrianPointCount, params.pedestrianPathWidth]);
  const num = (key: keyof Params, min: number, max: number, step: number, label: string, unit = '') => <Slider label={label} value={params[key] as number} min={min} max={max} step={step} unit={unit} set={(value) => set(key, value as never)} />;
  return <main className="dome-app"><div ref={mount} className="scene" /><div className="brand"><strong>D O M Y</strong><small>Pastel light field study</small></div><div className="hint">Drag to orbit · Right drag to pan · Scroll to zoom · Drag white nodes to edit the dome path</div><aside className="panel"><button className="toggle" onClick={() => setOpen(!open)}>{open ? 'Hide controls' : 'Controls'}</button>{open && <div className="inside"><section><h2>Geometry</h2>{num('count',1,24,1,'Dome count')}{num('radius',.5,2,.05,'Dome radius')}{num('cut',90,130,1,'Cut angle','°')}{num('miniMin',0,6,1,'Mini dome min')}{num('miniMax',2,10,1,'Mini dome max')}{num('miniScaleMin',.08,.5,.01,'Mini radius min')}{num('miniScaleMax',.08,.5,.01,'Mini radius max')}</section><section><h2>Paths</h2>{num('pathWidth',.5,6,.1,'Dome path width')}{num('pedestrianPathWidth',.5,8,.1,'Gravel path width')}{num('pedestrianOffset',-20,20,.1,'Pedestrian offset')}{num('pedestrianPointCount',2,60,1,'Pedestrian points')}<label><input type="checkbox" checked={params.showCollisionStrip} onChange={e=>set('showCollisionStrip',e.target.checked)} /> Show dome path</label><label><input type="checkbox" checked={params.showPedestrianPath} onChange={e=>set('showPedestrianPath',e.target.checked)} /> Show pedestrian path</label></section><section><h2>Color field</h2>{num('points',1,8,1,'Points per dome')}{num('influence',.1,3,.05,'Influence radius')}{num('blend',1,6,.1,'Blend softness')}{num('roam',0,1,.01,'Roam speed')}{num('colorSpeed',.5,20,.5,'Color duration','s')}{num('saturation',0,3,.05,'Saturation')}<div className="palette">{params.palette.map((color, index) => <input key={index} type="color" aria-label={`Palette color ${index + 1}`} value={color} onChange={(event) => set('palette', setPaletteColor(params.palette, index, event.target.value))} />)}</div></section><section><h2>Glow</h2>{num('emission',0,3,.05,'Emission')}{num('bloom',0,1.5,.05,'Bloom')}</section><section><h2>Night lighting</h2>{num('moonlight',0,.6,.01,'Moonlight')}{num('skyLight',0,.6,.01,'Sky light')}{num('pointLightsPerDome',0,params.points,1,'Point lights per dome')}{num('pointLightIntensity',0,50,.1,'Point light brightness')}{num('pointLightRange',1,30,.1,'Point light range')}</section><section><h2>Behavior</h2>{num('factor',0,1,.01,'Propagation factor')}{num('delay',0,1000,10,'Propagation delay','ms')}{num('decayStep',10,500,10,'Decay interval','ms')}<Slider label="Decay amount" value={params.decay*100} min={1} max={100} step={1} unit="%" set={v=>set('decay',v/100)} /></section><label><input type="checkbox" checked={params.showPoints} onChange={e=>set('showPoints',e.target.checked)} /> Show color points</label><label><input type="checkbox" checked={params.showHandles} onChange={e=>set('showHandles',e.target.checked)} /> Show dome path handles</label><div className="buttons"><button onClick={()=>set('paused',!params.paused)}>{params.paused?'Resume':'Pause'}</button><button onClick={()=>api.current?.rebuild()}>Regenerate</button><button onClick={()=>api.current?.reset()}>Reset camera</button><button onClick={savePreset}>Save preset</button><button onClick={exportPreset}>Export parameters</button><button onClick={loadPreset}>Load preset</button><button onClick={()=>setParams(defaults)}>Reset defaults</button></div></div>}</aside></main>;
}

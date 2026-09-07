'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createMiniAttachments } from '@/lib/dome';
import { activateDome, advanceLighting, clearActivation, createLightingState } from '@/lib/lighting';
import { mergePreset } from '@/lib/preset';

const palette = ['#f6b8c8', '#f7cfa8', '#f5e6aa', '#bce3cf', '#bbdcf2', '#d2c2ef'];
const defaults = { count: 12, radius: 1, cut: 110, miniMin: 2, miniMax: 6, miniScaleMin: .14, miniScaleMax: .32, pathWidth: 2.5, points: 4, influence: .8, blend: 2, roam: .15, colorSpeed: 6, saturation: 1, emission: 1, bloom: .35, factor: .67, delay: 300, decayStep: 50, decay: .5, showPoints: false, showHandles: true, showCollisionStrip: true, paused: false };
type Params = typeof defaults;
type Dome = { group: THREE.Group; material: THREE.ShaderMaterial; minis: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]; attachments: ReturnType<typeof createMiniAttachments>; points: { phase: THREE.Vector3; color: THREE.Color; position: THREE.Vector3 }[]; markers: THREE.Mesh[]; display: number };

const random = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const bulbGeometry = (radius: number, cut: number) => { const g = new THREE.SphereGeometry(radius, 96, 48, 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(cut)); g.rotateX(Math.PI / 2); g.translate(0, 0, -radius * Math.cos(THREE.MathUtils.degToRad(cut))); return g; };
const material = () => new THREE.ShaderMaterial({
  uniforms: { p: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) }, c: { value: Array.from({ length: 8 }, () => new THREE.Color()) }, n: { value: 4 }, brightness: { value: 0 }, influence: { value: .8 }, blend: { value: 2 }, saturation: { value: 1 }, emission: { value: 1 }, opacity: { value: 1 } },
  vertexShader: 'varying vec3 v; varying vec3 no; void main(){v=position;no=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform vec3 p[8];uniform vec3 c[8];uniform int n;uniform float brightness,influence,blend,saturation,emission,opacity;varying vec3 v;varying vec3 no;void main(){vec3 f=vec3(0.);float total=0.;for(int i=0;i<8;i++){if(i>=n)break;float w=exp(-pow(length(v-p[i])/max(influence,.01),blend));f+=c[i]*w;total+=w;}f/=max(total,.001);f=mix(vec3(dot(f,vec3(.2126,.7152,.0722))),f,saturation);float active=step(.001,brightness);vec3 base=mix(vec3(.32),f,active);float light=.72+.28*max(dot(no,normalize(vec3(-.4,.3,.9))),0.);gl_FragColor=vec4(base*light+f*brightness*emission*.34,opacity);}',
});

function Slider({ label, value, min, max, step, unit = '', set }: { label: string; value: number; min: number; max: number; step: number; unit?: string; set: (n: number) => void }) {
  return <label className="control"><span>{label}</span><b>{Number(value.toFixed(2))}{unit}</b><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} /></label>;
}

export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const api = useRef<{ rebuild: () => void; reset: () => void } | null>(null);
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
  const loadPreset = () => {
    const saved = localStorage.getItem('domy-preset');
    if (saved) setParams(mergePreset(defaults, JSON.parse(saved)));
  };

  useEffect(() => {
    const host = mount.current!;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#343737');
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, .1, 100); camera.up.set(0, 0, 1); camera.position.set(10, -17, 14);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; host.appendChild(renderer.domElement);
    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), .35, .4, .85); composer.addPass(bloom);
    const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.target.set(0, 0, .6); orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    scene.add(new THREE.HemisphereLight('#fff', '#87998c', 2.4)); const sun = new THREE.DirectionalLight('#fff', 2); sun.position.set(-7, -10, 16); scene.add(sun);
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#3d4141', roughness: 1 })));

    const controls = [new THREE.Vector3(-11, -2.4, 0), new THREE.Vector3(-6.2, 2.4, 0), new THREE.Vector3(-1.8, -2.1, 0), new THREE.Vector3(4.2, 2.1, 0), new THREE.Vector3(10.8, -.6, 0)];
    const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
    const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 180, values.current.pathWidth / 2, 16, false), new THREE.MeshBasicMaterial({ color: '#c9d2ca', transparent: true, opacity: .45 })); scene.add(path);
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#7f9083' })); scene.add(line);
    const handles = controls.map((point, index) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(.18, 20, 14), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#81b493', emissiveIntensity: .5 })); mesh.position.copy(point).setZ(.13); mesh.userData.index = index; scene.add(mesh); return mesh; });
    const root = new THREE.Group(); scene.add(root); const domes: Dome[] = [];
    let lighting = createLightingState(values.current.count, { propagationDelay: values.current.delay, propagationFactor: values.current.factor, decayInterval: values.current.decayStep, decayAmount: values.current.decay });

    const positionDomes = () => domes.forEach((d, i) => d.group.position.copy(curve.getPointAt(domes.length === 1 ? .5 : i / (domes.length - 1))));
    const refreshPath = () => { path.geometry.dispose(); path.geometry = new THREE.TubeGeometry(curve, 180, values.current.pathWidth / 2, 16, false); line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(180).map((p) => p.setZ(.02))); handles.forEach((h, i) => h.position.copy(controls[i]).setZ(.13)); positionDomes(); };
    const rebuild = () => {
      domes.forEach((d) => { d.material.dispose(); d.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }); root.clear(); domes.length = 0;
      for (let i = 0; i < values.current.count; i++) {
        const v = values.current, rng = random(Date.now() + i * 931), group = new THREE.Group(), mat = material(), main = new THREE.Mesh(bulbGeometry(v.radius, v.cut), mat); group.add(main);
        const points = Array.from({ length: v.points }, () => ({ phase: new THREE.Vector3(rng() * 6.28, rng() * 6.28, rng() * 6.28), color: new THREE.Color(palette[Math.floor(rng() * palette.length)]), position: new THREE.Vector3() }));
        const attachments = createMiniAttachments({ count: v.miniMin + Math.floor(rng() * (v.miniMax - v.miniMin + 1)), domeRadius: v.radius, cutAngle: THREE.MathUtils.degToRad(v.cut), minRadius: v.radius * v.miniScaleMin, maxRadius: v.radius * v.miniScaleMax, random: rng });
        const minis = attachments.map((a) => { const mini = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#595959', roughness: .38 })); mini.scale.setScalar(a.radius); mini.position.copy(a.position); mini.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.normal); group.add(mini); return mini; });
        const markers = points.map(() => { const marker = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), new THREE.MeshBasicMaterial()); group.add(marker); return marker; });
        root.add(group); domes.push({ group, material: mat, minis, attachments, points, markers, display: 0 });
      }
      positionDomes(); lighting = createLightingState(domes.length, { propagationDelay: values.current.delay, propagationFactor: values.current.factor, decayInterval: values.current.decayStep, decayAmount: values.current.decay });
    };
    rebuild(); refreshPath(); api.current = { rebuild, reset: () => { camera.position.set(10, -17, 14); orbit.target.set(0, 0, .6); orbit.update(); } };

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); let dragging: number | null = null, active: number | null = null, orbiting = false;
    const groundPoint = (e: PointerEvent) => { const box = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - box.left) / box.width * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1); ray.setFromCamera(pointer, camera); return ray.ray.intersectPlane(plane, new THREE.Vector3()); };
    const hover = (e: PointerEvent) => { if (dragging !== null || orbiting) return; const p = groundPoint(e); if (!p) return; const distance = Math.min(...curve.getSpacedPoints(180).map((q) => q.distanceTo(p))); if (distance > values.current.pathWidth / 2) { if (active !== null) { lighting = clearActivation(lighting, performance.now()); active = null; } return; } const next = domes.reduce((best, d, i) => d.group.position.distanceToSquared(p) < domes[best].group.position.distanceToSquared(p) ? i : best, 0); if (next !== active) { lighting = activateDome(lighting, next, performance.now()); active = next; } };
    const down = (e: PointerEvent) => { const p = groundPoint(e); if (!p) return; const hit = ray.intersectObjects(handles)[0]; if (hit && values.current.showHandles) { dragging = hit.object.userData.index; orbit.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); } else orbiting = true; };
    const move = (e: PointerEvent) => { if (dragging !== null) { const p = groundPoint(e); if (p) { controls[dragging].set(p.x, p.y, 0); refreshPath(); } } else hover(e); };
    const up = (e: PointerEvent) => { dragging = null; orbiting = false; orbit.enabled = true; if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId); hover(e); };
    const leave = () => { if (active !== null) { lighting = clearActivation(lighting, performance.now()); active = null; } };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointerleave', leave);
    const resize = () => { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); composer.setSize(host.clientWidth, host.clientHeight); }; window.addEventListener('resize', resize);
    let last = performance.now(), frame = 0;
    const draw = (now: number) => { frame = requestAnimationFrame(draw); const v = values.current, dt = Math.min((now - last) / 1000, .05); last = now; lighting.options = { propagationDelay: v.delay, propagationFactor: v.factor, decayInterval: v.decayStep, decayAmount: v.decay }; if (!v.paused) lighting = advanceLighting(lighting, now); bloom.strength = v.bloom; path.visible = v.showCollisionStrip; handles.forEach((h) => h.visible = v.showHandles);
      domes.forEach((d, i) => { d.display += ((lighting.brightness[i] || 0) - d.display) * Math.min(dt * 12, 1); const u = d.material.uniforms; u.brightness.value = d.display; u.n.value = d.points.length; u.influence.value = v.influence * v.radius; u.blend.value = v.blend; u.saturation.value = v.saturation; u.emission.value = v.emission; u.opacity.value = v.showPoints ? .78 : 1;
        d.points.forEach((point, j) => { if (!v.paused) { const t = now * .001 * v.roam; point.position.set(Math.sin(t * 1.1 + point.phase.x) * v.radius * .38, Math.cos(t * .87 + point.phase.y) * v.radius * .38, v.radius * .8 + Math.sin(t * 1.27 + point.phase.z) * v.radius * .28); const a = Math.floor((t + point.phase.x) / v.colorSpeed) % palette.length, b = (a + 1) % palette.length; point.color.lerpColors(new THREE.Color(palette[a]), new THREE.Color(palette[b]), ((t + point.phase.x) / v.colorSpeed) % 1); } u.p.value[j].copy(point.position); u.c.value[j].copy(point.color); d.markers[j].position.copy(point.position); d.markers[j].visible = v.showPoints; (d.markers[j].material as THREE.MeshBasicMaterial).color.copy(point.color); });
        d.minis.forEach((mini, j) => { const attachment = d.attachments[j]; const field = new THREE.Color(0, 0, 0); let total = 0; d.points.forEach((point) => { const weight = Math.exp(-Math.pow(point.position.distanceTo(attachment.position) / Math.max(v.influence * v.radius, .01), v.blend)); field.r += point.color.r * weight; field.g += point.color.g * weight; field.b += point.color.b * weight; total += weight; }); field.multiplyScalar(1 / total); const luma = field.r * .2126 + field.g * .7152 + field.b * .0722; field.lerp(new THREE.Color(luma, luma, luma), 1 - v.saturation); mini.material.color.copy(d.display > .001 ? field : new THREE.Color(.32, .32, .32)); mini.material.emissive.copy(field).multiplyScalar(d.display * v.emission * .28); }); }); orbit.update(); composer.render(); };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointerleave', leave); renderer.dispose(); host.removeChild(renderer.domElement); };
  }, []);
  useEffect(() => { api.current?.rebuild(); }, [params.count, params.radius, params.cut, params.miniMin, params.miniMax, params.miniScaleMin, params.miniScaleMax, params.points]);
  useEffect(() => { api.current?.rebuild(); }, [params.pathWidth]);
  const num = (key: keyof Params, min: number, max: number, step: number, label: string, unit = '') => <Slider label={label} value={params[key] as number} min={min} max={max} step={step} unit={unit} set={(value) => set(key, value as never)} />;
  return <main className="dome-app"><div ref={mount} className="scene" /><div className="brand"><strong>D O M Y</strong><small>Pastel light field study</small></div><div className="hint">Drag to orbit · Right drag to pan · Scroll to zoom · Drag white nodes to edit the path</div><aside className="panel"><button className="toggle" onClick={() => setOpen(!open)}>{open ? 'Hide controls' : 'Controls'}</button>{open && <div className="inside"><section><h2>Geometry</h2>{num('count',1,24,1,'Dome count')}{num('radius',.5,2,.05,'Dome radius')}{num('cut',90,130,1,'Cut angle','°')}{num('miniMin',0,6,1,'Mini dome min')}{num('miniMax',2,10,1,'Mini dome max')}{num('miniScaleMin',.08,.5,.01,'Mini radius min')}{num('miniScaleMax',.08,.5,.01,'Mini radius max')}</section><section><h2>Path</h2>{num('pathWidth',.5,6,.1,'Path width')}<label><input type="checkbox" checked={params.showCollisionStrip} onChange={e=>set('showCollisionStrip',e.target.checked)} /> Show collision strip</label></section><section><h2>Color field</h2>{num('points',1,8,1,'Points per dome')}{num('influence',.1,3,.05,'Influence radius')}{num('blend',1,6,.1,'Blend softness')}{num('roam',0,1,.01,'Roam speed')}{num('colorSpeed',.5,20,.5,'Color duration','s')}{num('saturation',0,1.5,.05,'Saturation')}<div className="palette">{palette.map(c => <i key={c} style={{background:c}} />)}</div></section><section><h2>Glow</h2>{num('emission',0,3,.05,'Emission')}{num('bloom',0,1.5,.05,'Bloom')}</section><section><h2>Behavior</h2>{num('factor',0,1,.01,'Propagation factor')}{num('delay',0,1000,10,'Propagation delay','ms')}{num('decayStep',10,500,10,'Decay interval','ms')}<Slider label="Decay amount" value={params.decay*100} min={1} max={100} step={1} unit="%" set={v=>set('decay',v/100)} /></section><label><input type="checkbox" checked={params.showPoints} onChange={e=>set('showPoints',e.target.checked)} /> Show color points</label><label><input type="checkbox" checked={params.showHandles} onChange={e=>set('showHandles',e.target.checked)} /> Show path handles</label><div className="buttons"><button onClick={()=>set('paused',!params.paused)}>{params.paused?'Resume':'Pause'}</button><button onClick={()=>api.current?.rebuild()}>Regenerate</button><button onClick={()=>api.current?.reset()}>Reset camera</button><button onClick={savePreset}>Save preset</button><button onClick={loadPreset}>Load preset</button><button onClick={()=>setParams(defaults)}>Reset defaults</button></div></div>}</aside></main>;
}

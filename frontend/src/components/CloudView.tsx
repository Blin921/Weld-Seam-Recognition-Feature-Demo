"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Cloud, Seam, Vec, displayPoint, samplePath } from "@/lib/core";
type Props = {
  cloud: Cloud | null;
  seams: Seam[];
  selected: number | null;
  mode: string;
  size: number;
  reset: number;
  points: Vec[];
  wpr: Vec[];
  distance: number;
  light?: boolean;
};
type Runtime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  cloud: THREE.Group;
  seams: THREE.Group;
  helpers: THREE.Group;
  tcp: THREE.Group;
  trail: THREE.Line;
  span: number;
  trailScratch: number | null;
  seamObjects: Map<number, { line: Line2; waypoints: THREE.Group }>;
};
function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (
      o instanceof THREE.Mesh ||
      o instanceof THREE.Points ||
      o instanceof THREE.Line
    ) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
function clearGroup(group: THREE.Group) {
  disposeTree(group);
  group.clear();
}
function spanOf(cloud: Cloud | null) {
  const e = cloud?.header.extent;
  return e ? Math.max(e[3] - e[0], e[4] - e[1], e[5] - e[2], 20) : 500;
}
export default function CloudView(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    runtime = useRef<Runtime | null>(null);
  const palettes = useMemo(() => {
    const count = p.cloud?.header.n ?? 0,
      semantic = new Float32Array(count * 3),
      instance = new Float32Array(count * 3);
    if (p.cloud) {
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        semantic.set(
          [
            p.cloud.rgb[i * 3] / 255,
            p.cloud.rgb[i * 3 + 1] / 255,
            p.cloud.rgb[i * 3 + 2] / 255,
          ],
          i * 3,
        );
        if (p.cloud.instance[i] === 0) color.setRGB(0.16, 0.18, 0.2);
        else color.setHSL((p.cloud.instance[i] * 0.618) % 1, 0.7, 0.55);
        instance.set([color.r, color.g, color.b], i * 3);
      }
    }
    return { semantic, instance };
  }, [p.cloud]);
  // Renderer, camera and controls live for the component lifetime. UI changes never recreate them.
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      element.dataset.error = "浏览器无法创建 WebGL 视图，请启用硬件加速";
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000),
      controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const cloud = new THREE.Group(),
      seams = new THREE.Group(),
      helpers = new THREE.Group(),
      tcp = new THREE.Group();
    const coordinateGroup = new THREE.Group();
    coordinateGroup.scale.y = -1;
    coordinateGroup.add(tcp);
    tcp.add(new THREE.AxesHelper(1));
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.1875, 0.875, 12),
      new THREE.MeshNormalMaterial(),
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = -0.4375;
    tcp.add(cone);
    tcp.visible = false;
    const trail = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xff8d3b }),
    );
    trail.frustumCulled = false;
    scene.add(cloud, seams, helpers, coordinateGroup, trail);
    const rt: Runtime = {
      scene,
      camera,
      controls,
      renderer,
      cloud,
      seams,
      helpers,
      tcp,
      trail,
      span: 500,
      trailScratch: null,
      seamObjects: new Map(),
    };
    runtime.current = rt;
    let drawable = false;
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      drawable = w > 0 && h > 0;
      if (!drawable) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rt.seamObjects.forEach(({ line }) => line.material.resolution.set(w, h));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (drawable && !document.hidden) {
        controls.update();
        renderer.render(scene, camera);
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    clearGroup(rt.cloud);
    if (!p.cloud) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(p.cloud.xyz, 3),
    );
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ vertexColors: true, sizeAttenuation: false }),
    );
    points.scale.y = -1;
    rt.cloud.add(points);
  }, [p.cloud]);
  useEffect(() => {
    const points = runtime.current?.cloud.children[0];
    if (points instanceof THREE.Points) {
      if (!points.geometry.getAttribute("semanticColor")) {
        points.geometry.setAttribute(
          "semanticColor",
          new THREE.BufferAttribute(palettes.semantic, 3),
        );
        points.geometry.setAttribute(
          "instanceColor",
          new THREE.BufferAttribute(palettes.instance, 3),
        );
      }
      points.geometry.setAttribute(
        "color",
        points.geometry.getAttribute(
          p.mode === "instance" ? "instanceColor" : "semanticColor",
        ),
      );
    }
  }, [p.cloud, p.mode, palettes]);
  useEffect(() => {
    const points = runtime.current?.cloud.children[0];
    if (points instanceof THREE.Points)
      points.material.setValues({ size: p.size });
  }, [p.cloud, p.size]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    const center = p.cloud
      ? displayPoint(p.cloud.header.center)
      : ([0, 0, 0] as Vec);
    const span = spanOf(p.cloud);
    rt.span = span;
    rt.camera.position.set(
      center[0] + span * 0.9,
      center[1] + span * 0.6,
      center[2] + span * 1.5,
    );
    rt.controls.target.set(...center);
    rt.camera.lookAt(...center);
    rt.controls.update();
    rt.tcp.scale.setScalar(span * 0.08);
  }, [p.cloud, p.reset]);
  // Rebuild only inexpensive helpers when the frame or theme changes; preserve the view.
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    clearGroup(rt.helpers);
    const span = spanOf(p.cloud),
      center = p.cloud
        ? displayPoint(p.cloud.header.center)
        : ([0, 0, 0] as Vec);
    const size = Math.ceil(span / 10) * 20;
    const grid = new THREE.GridHelper(
      size,
      size / 10,
      p.light ? 0xc6dbea : 0x334452,
      p.light ? 0xd5e4ee : 0x1b2834,
    );
    grid.position.set(
      center[0],
      p.cloud ? -p.cloud.header.extent[4] - 10 : -100,
      center[2],
    );
    const axes = new THREE.AxesHelper(span * 0.13);
    axes.position.set(center[0] - span * 0.6, grid.position.y, center[2]);
    rt.helpers.add(grid, axes);
    rt.scene.background = new THREE.Color(p.light ? "#ecf4f9" : "#0d1218");
  }, [p.cloud, p.light]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    clearGroup(rt.seams);
    rt.seamObjects.clear();
    const sphereGeometry = new THREE.SphereGeometry(
        spanOf(p.cloud) * 0.003,
        8,
        8,
      ),
      sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const seam of p.seams) {
      if (!seam.trajectory_mm?.length) continue;
      const geometry = new LineGeometry();
      geometry.setPositions(seam.trajectory_mm.flatMap(displayPoint));
      const material = new LineMaterial({ color: 0x21cbd1, linewidth: 1.5 });
      material.resolution.set(
        rt.renderer.domElement.clientWidth || 1,
        rt.renderer.domElement.clientHeight || 1,
      );
      const line = new Line2(geometry, material),
        waypoints = new THREE.Group();
      for (const point of seam.trajectory_mm) {
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(...displayPoint(point));
        waypoints.add(sphere);
      }
      rt.seams.add(line, waypoints);
      rt.seamObjects.set(seam.id, { line, waypoints });
    }
    if (!rt.seamObjects.size) {
      sphereGeometry.dispose();
      sphereMaterial.dispose();
    }
  }, [p.seams, p.cloud]);
  useEffect(() => {
    runtime.current?.seamObjects.forEach(({ line, waypoints }, id) => {
      const chosen = id === p.selected;
      line.material.color.setHex(chosen ? 0xffd65a : 0x21cbd1);
      line.material.linewidth = chosen ? 4 : 1.5;
      waypoints.visible = chosen;
    });
  }, [p.selected, p.seams, p.cloud]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    rt.trail.geometry.dispose();
    const data = new Float32Array((p.points.length + 1) * 3);
    p.points.forEach((point, i) => data.set(displayPoint(point), i * 3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(data, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setDrawRange(0, 0);
    rt.trail.geometry = geometry;
    rt.trailScratch = null;
  }, [p.points]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    const { point, segment } = samplePath(p.points, p.distance);
    rt.tcp.visible = !!p.points.length;
    rt.tcp.position.set(...point);
    rt.tcp.rotation.set(
      ...((p.wpr[segment] ?? [180, 0, 0]).map(THREE.MathUtils.degToRad) as Vec),
      "ZYX",
    );
    const attr = rt.trail.geometry.getAttribute("position");
    if (attr && p.points.length) {
      if (rt.trailScratch !== null && rt.trailScratch < p.points.length)
        attr.setXYZ(
          rt.trailScratch,
          ...displayPoint(p.points[rt.trailScratch]),
        );
      attr.setXYZ(segment + 1, ...displayPoint(point));
      rt.trailScratch = segment + 1;
      attr.needsUpdate = true;
      rt.trail.geometry.setDrawRange(0, segment + 2);
    } else rt.trail.geometry.setDrawRange(0, 0);
  }, [p.points, p.wpr, p.distance]);
  return <div className="cloud-canvas" ref={host} />;
}

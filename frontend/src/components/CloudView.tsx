"use client";
import { useEffect, useRef, useMemo } from "react";
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
export default function CloudView(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const marker = useRef<THREE.Group | null>(null);
  const trail = useRef<THREE.Line | null>(null);
  const palettes = useMemo(() => {
    const semantic = new Float32Array((p.cloud?.header.n ?? 0) * 3),
      instanceColors = new Float32Array(semantic.length);
    if (p.cloud) {
      const c = new THREE.Color();
      for (let i = 0; i < p.cloud.header.n; i++) {
        semantic.set(
          [
            p.cloud.rgb[i * 3] / 255,
            p.cloud.rgb[i * 3 + 1] / 255,
            p.cloud.rgb[i * 3 + 2] / 255,
          ],
          i * 3,
        );
        if (p.cloud.instance[i] === 0) c.setRGB(0.16, 0.18, 0.2);
        else c.setHSL((p.cloud.instance[i] * 0.618) % 1, 0.7, 0.55);
        instanceColors.set([c.r, c.g, c.b], i * 3);
      }
    }
    return { semantic, instance: instanceColors };
  }, [p.cloud]);
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
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(p.light ? "#ecf4f9" : "#0d1218");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const center = p.cloud
      ? displayPoint(p.cloud.header.center)
      : ([0, 0, 0] as Vec);
    const extent = p.cloud?.header.extent;
    const span = extent
      ? Math.max(
          extent[3] - extent[0],
          extent[4] - extent[1],
          extent[5] - extent[2],
          20,
        )
      : 500;
    camera.position.set(
      center[0] + span * 0.9,
      center[1] + span * 0.6,
      center[2] + span * 1.5,
    );
    controls.target.set(...center);
    camera.lookAt(...center);
    const gridSize = Math.ceil(span / 10) * 20;
    const grid = new THREE.GridHelper(
      gridSize,
      gridSize / 10,
      p.light ? 0xc6dbea : 0x334452,
      p.light ? 0xd5e4ee : 0x1b2834,
    );
    grid.position.set(center[0], extent ? -extent[4] - 10 : -100, center[2]);
    scene.add(grid);
    const axes = new THREE.AxesHelper(span * 0.13);
    axes.position.set(center[0] - span * 0.6, grid.position.y, center[2]);
    scene.add(axes);
    if (p.cloud) {
      const { xyz } = p.cloud;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(xyz, 3));
      const colors =
        p.mode === "instance" ? palettes.instance : palettes.semantic;
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: p.size,
          sizeAttenuation: false,
          vertexColors: true,
        }),
      );
      points.scale.y = -1;
      scene.add(points);
    }
    for (const seam of p.seams) {
      if (!seam.trajectory_mm?.length) continue;
      const chosen = seam.id === p.selected;
      const geometry = new LineGeometry();
      geometry.setPositions(seam.trajectory_mm.flatMap(displayPoint));
      const material = new LineMaterial({
        color: chosen ? (p.light ? 0x008f83 : 0xffd65a) : 0x21cbd1,
        linewidth: chosen ? 4 : 1.5,
      });
      const line = new Line2(geometry, material);
      scene.add(line);
      if (chosen)
        for (const point of seam.trajectory_mm) {
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(span * 0.003, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
          );
          sphere.position.set(...displayPoint(point));
          scene.add(sphere);
        }
    }
    const tcp = new THREE.Group();
    tcp.add(new THREE.AxesHelper(span * 0.08));
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(span * 0.015, span * 0.07, 12),
      new THREE.MeshNormalMaterial(),
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = -span * 0.035;
    tcp.add(cone);
    const coordinateGroup = new THREE.Group();
    coordinateGroup.scale.y = -1;
    coordinateGroup.add(tcp);
    scene.add(coordinateGroup);
    tcp.visible = false;
    marker.current = tcp;
    const traveled = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xff8d3b }),
    );
    scene.add(traveled);
    trail.current = traveled;
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      scene.traverse((o) => {
        if (o instanceof Line2) o.material.resolution.set(w, h);
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      controls.update();
      renderer.render(scene, camera);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Points
        ) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      marker.current = null;
      trail.current = null;
    };
  }, [
    p.cloud,
    p.seams,
    p.selected,
    p.mode,
    p.size,
    p.reset,
    palettes,
    p.light,
  ]);
  useEffect(() => {
    if (!marker.current) return;
    const { point, segment } = samplePath(p.points, p.distance);
    marker.current.visible = !!p.points.length;
    marker.current.position.set(...point);
    const angles = p.wpr[segment] ?? [180, 0, 0];
    marker.current.rotation.set(
      ...(angles.map(THREE.MathUtils.degToRad) as Vec),
      "ZYX",
    );
    if (trail.current) {
      trail.current.geometry.dispose();
      trail.current.geometry = new THREE.BufferGeometry().setFromPoints(
        [...p.points.slice(0, segment + 1), point].map(
          (v) => new THREE.Vector3(...displayPoint(v)),
        ),
      );
    }
  }, [
    p.points,
    p.wpr,
    p.distance,
    p.cloud,
    p.reset,
    p.mode,
    p.size,
    p.selected,
    p.seams,
  ]);
  return <div className="cloud-canvas" ref={host} />;
}

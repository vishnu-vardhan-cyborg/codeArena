import { useEffect, useRef } from "react";
import * as THREE from "three";
import "../styles/PreviewScene.css";

const createGlyphTexture = (glyph, accent) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  context.fillStyle = "#10272d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = accent;
  context.lineWidth = 10;
  context.strokeRect(14, 14, 228, 228);
  context.fillStyle = accent;
  context.font = "bold 72px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(glyph, 128, 132);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const createOrbitLine = (radiusX, radiusZ, rotationX, color) => {
  const points = Array.from({ length: 128 }, (_, index) => {
    const angle = (index / 128) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radiusX,
      0,
      Math.sin(angle) * radiusZ
    );
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.24,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.rotation.x = rotationX;
  return line;
};

const disposeMaterial = (material) => {
  if (!material) return;

  Object.values(material).forEach((value) => {
    if (value?.isTexture) value.dispose();
  });
  material.dispose();
};

export default function SpaceCodeScene() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    let animationFrame = 0;
    let renderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isMobile,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      container.dataset.webgl = "unavailable";
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.7));
    renderer.setClearColor(0x071116, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x071116, 0.027);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    camera.position.set(0, 2.2, 18);

    const world = new THREE.Group();
    world.position.set(isMobile ? 5.8 : 5.3, isMobile ? -1.35 : 0.4, 0);
    scene.add(world);

    scene.add(new THREE.HemisphereLight(0x77e7d4, 0x071116, 1.1));
    const coreLight = new THREE.PointLight(0x61d3c2, 45, 20, 1.6);
    coreLight.position.set(0, 0, 0);
    world.add(coreLight);
    const coralLight = new THREE.PointLight(0xef6655, 30, 18, 1.8);
    coralLight.position.set(4, 2, 2);
    world.add(coralLight);

    const coreGroup = new THREE.Group();
    world.add(coreGroup);

    const coreGeometry = new THREE.IcosahedronGeometry(2.05, 2);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x112f36,
      emissive: 0x118b7c,
      emissiveIntensity: 1.2,
      metalness: 0.75,
      roughness: 0.22,
      wireframe: true,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    coreGroup.add(core);

    const innerGeometry = new THREE.IcosahedronGeometry(1.18, 1);
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xef6655,
      emissive: 0xef6655,
      emissiveIntensity: 1.9,
      metalness: 0.4,
      roughness: 0.28,
    });
    const innerCore = new THREE.Mesh(innerGeometry, innerMaterial);
    coreGroup.add(innerCore);

    const haloGeometry = new THREE.TorusGeometry(2.75, 0.035, 8, 128);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x61d3c2,
      transparent: true,
      opacity: 0.65,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2.6;
    coreGroup.add(halo);

    const orbitConfigs = [
      {
        radiusX: 4.3,
        radiusZ: 3.1,
        speed: 0.36,
        tilt: 0.34,
        glyph: "{ }",
        color: "#61d3c2",
        phase: 0.5,
      },
      {
        radiusX: 6.2,
        radiusZ: 4.6,
        speed: -0.21,
        tilt: -0.48,
        glyph: "</>",
        color: "#ef6655",
        phase: 2.6,
      },
      {
        radiusX: 7.8,
        radiusZ: 5.8,
        speed: 0.14,
        tilt: 0.7,
        glyph: "AI",
        color: "#f4cb66",
        phase: 4.1,
      },
    ];

    const satellites = orbitConfigs.map((config) => {
      const orbit = createOrbitLine(
        config.radiusX,
        config.radiusZ,
        config.tilt,
        config.color
      );
      world.add(orbit);

      const group = new THREE.Group();
      const texture = createGlyphTexture(config.glyph, config.color);
      const boxMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(config.color),
        emissiveIntensity: 0.22,
        metalness: 0.75,
        roughness: 0.25,
      });
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 1.08, 1.08),
        boxMaterial
      );
      group.add(box);

      const nodeLight = new THREE.PointLight(
        new THREE.Color(config.color),
        7,
        6,
        2
      );
      group.add(nodeLight);
      world.add(group);

      return { ...config, group, box };
    });

    const starCount = isMobile ? 700 : 1450;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const teal = new THREE.Color(0x61d3c2);
    const white = new THREE.Color(0xd8e6e7);

    for (let index = 0; index < starCount; index += 1) {
      const radius = 18 + Math.random() * 42;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const offset = index * 3;
      starPositions[offset] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[offset + 1] = radius * Math.cos(phi);
      starPositions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const color = Math.random() > 0.84 ? teal : white;
      starColors[offset] = color.r;
      starColors[offset + 1] = color.g;
      starColors[offset + 2] = color.b;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: isMobile ? 0.07 : 0.085,
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const debris = new THREE.Group();
    const debrisGeometry = new THREE.TetrahedronGeometry(0.18, 0);
    for (let index = 0; index < (isMobile ? 18 : 36); index += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: index % 5 === 0 ? 0xef6655 : 0x4a7478,
        metalness: 0.7,
        roughness: 0.4,
      });
      const shard = new THREE.Mesh(debrisGeometry, material);
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 10;
      shard.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 11,
        Math.sin(angle) * radius
      );
      shard.rotation.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
      shard.scale.setScalar(0.55 + Math.random() * 1.8);
      debris.add(shard);
    }
    world.add(debris);

    const pointer = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2();
    const handlePointerMove = (event) => {
      pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerTarget.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const clock = new THREE.Clock();
    const render = () => {
      const elapsed = clock.getElapsedTime();
      pointer.lerp(pointerTarget, 0.035);

      core.rotation.x = elapsed * 0.11;
      core.rotation.y = elapsed * 0.19;
      innerCore.rotation.x = -elapsed * 0.25;
      innerCore.rotation.y = elapsed * 0.3;
      const pulse = 1 + Math.sin(elapsed * 2.1) * 0.06;
      innerCore.scale.setScalar(pulse);
      halo.rotation.z = elapsed * 0.18;

      satellites.forEach((satellite, index) => {
        const angle = elapsed * satellite.speed + satellite.phase;
        const rawPosition = new THREE.Vector3(
          Math.cos(angle) * satellite.radiusX,
          Math.sin(angle * 1.7 + index) * 0.65,
          Math.sin(angle) * satellite.radiusZ
        );
        rawPosition.applyAxisAngle(
          new THREE.Vector3(1, 0, 0),
          satellite.tilt
        );
        satellite.group.position.copy(rawPosition);
        satellite.box.rotation.x = elapsed * (0.28 + index * 0.07);
        satellite.box.rotation.y = elapsed * (0.4 + index * 0.05);
      });

      debris.rotation.y = elapsed * 0.025;
      debris.rotation.z = elapsed * -0.008;
      stars.rotation.y = elapsed * 0.006;

      world.rotation.y += (pointer.x * 0.1 - world.rotation.y) * 0.02;
      world.rotation.x += (-pointer.y * 0.06 - world.rotation.x) * 0.02;
      camera.position.x += (pointer.x * 0.55 - camera.position.x) * 0.025;
      camera.position.y += (2.2 - pointer.y * 0.35 - camera.position.y) * 0.025;
      camera.lookAt(2.7, 0.2, 0);

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    if (prefersReducedMotion) {
      satellites.forEach((satellite, index) => {
        const angle = satellite.phase;
        satellite.group.position.set(
          Math.cos(angle) * satellite.radiusX,
          index * 0.4 - 0.4,
          Math.sin(angle) * satellite.radiusZ
        );
      });
      renderer.render(scene, camera);
    } else {
      render();
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(object.material);
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div className="space-code-scene" ref={containerRef} aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="space-scene-vignette" />
      <div className="space-scene-horizon" />
    </div>
  );
}

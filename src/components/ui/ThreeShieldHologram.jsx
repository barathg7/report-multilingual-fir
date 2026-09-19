import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function ThreeShieldHologram({ className = "w-full h-full min-h-[380px]" }) {
  const containerRef = useRef(null);
  const [webGLError, setWebGLError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer, scene, camera, animId;
    let shieldGroup, particles, ring1, ring2;
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;

    try {
      // Scene & Camera
      scene = new THREE.Scene();
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 7.5;

      // Renderer
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Root Group
      shieldGroup = new THREE.Group();
      scene.add(shieldGroup);

      // ── Shield Shape ──
      const shape = new THREE.Shape();
      // Start top center
      shape.moveTo(0, 1.8);
      shape.bezierCurveTo(0.6, 1.9, 1.4, 1.85, 1.7, 1.4);
      shape.bezierCurveTo(1.8, 0.4, 1.6, -0.6, 1.0, -1.4);
      shape.bezierCurveTo(0.6, -2.0, 0.2, -2.4, 0, -2.6);
      shape.bezierCurveTo(-0.2, -2.4, -0.6, -2.0, -1.0, -1.4);
      shape.bezierCurveTo(-1.6, -0.6, -1.8, 0.4, -1.7, 1.4);
      shape.bezierCurveTo(-1.4, 1.85, -0.6, 1.9, 0, 1.8);

      const extrudeSettings = {
        depth: 0.35,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 2,
        bevelSize: 0.12,
        bevelThickness: 0.15,
      };

      const shieldGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      shieldGeo.center();

      // Metallic Hologram Core Material
      const shieldMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#0c1b3f"),
        emissive: new THREE.Color("#082b5e"),
        roughness: 0.25,
        metalness: 0.85,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
      });

      const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
      shieldGroup.add(shieldMesh);

      // Wireframe Facet Highlight Layer
      const wireframeGeo = new THREE.WireframeGeometry(shieldGeo);
      const wireframeMat = new THREE.LineBasicMaterial({
        color: new THREE.Color("#38bdf8"),
        transparent: true,
        opacity: 0.35,
      });
      const wireframeLine = new THREE.LineSegments(wireframeGeo, wireframeMat);
      shieldGroup.add(wireframeLine);

      // Inner Core Emblem (Center Star / Diamond Crest)
      const crestGeo = new THREE.OctahedronGeometry(0.55, 0);
      const crestMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#00f2fe"),
        emissive: new THREE.Color("#0284c7"),
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.9,
      });
      const crestMesh = new THREE.Mesh(crestGeo, crestMat);
      crestMesh.position.z = 0.38;
      crestMesh.scale.set(0.9, 1.2, 0.5);
      shieldGroup.add(crestMesh);

      // ── Orbital Gyro Rings ──
      const ringGeo1 = new THREE.TorusGeometry(2.6, 0.022, 16, 100);
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#38bdf8"),
        transparent: true,
        opacity: 0.45,
      });
      ring1 = new THREE.Mesh(ringGeo1, ringMat1);
      ring1.rotation.x = Math.PI / 3;
      scene.add(ring1);

      const ringGeo2 = new THREE.TorusGeometry(3.1, 0.018, 16, 100);
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#818cf8"),
        transparent: true,
        opacity: 0.3,
      });
      ring2 = new THREE.Mesh(ringGeo2, ringMat2);
      ring2.rotation.y = Math.PI / 4;
      scene.add(ring2);

      // ── Particle Field / Digital Constellation ──
      const particleCount = 140;
      const posArray = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 11;
        posArray[i + 1] = (Math.random() - 0.5) * 11;
        posArray[i + 2] = (Math.random() - 0.5) * 6;
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
      const particleMat = new THREE.PointsMaterial({
        size: 0.055,
        color: new THREE.Color("#67e8f9"),
        transparent: true,
        opacity: 0.65,
      });
      particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // ── Dynamic Lights ──
      const ambientLight = new THREE.AmbientLight(0x0f2757, 2.5);
      scene.add(ambientLight);

      const dirLightTop = new THREE.DirectionalLight(0x38bdf8, 3.5);
      dirLightTop.position.set(4, 5, 4);
      scene.add(dirLightTop);

      const dirLightBlue = new THREE.DirectionalLight(0x6366f1, 2.8);
      dirLightBlue.position.set(-4, -3, 3);
      scene.add(dirLightBlue);

      const cursorLight = new THREE.PointLight(0x00f2fe, 3, 10);
      cursorLight.position.set(0, 0, 3);
      scene.add(cursorLight);

      // ── Mouse / Touch Tracking ──
      const handlePointerMove = (e) => {
        const rect = container.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
        if (clientX === undefined) return;

        const x = (clientX - rect.left) / rect.width - 0.5;
        const y = (clientY - rect.top) / rect.height - 0.5;
        targetX = x * 1.3;
        targetY = y * 1.1;

        cursorLight.position.x = x * 6;
        cursorLight.position.y = -y * 6;
      };

      window.addEventListener("pointermove", handlePointerMove);

      // ── Resize Handler ──
      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      // ── Animation Loop ──
      let clock = new THREE.Clock();

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Smooth cursor lerp
        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;

        // Subtle floating bounce & mouse tilt
        shieldGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.12;
        shieldGroup.rotation.y = mouseX * 0.8 + Math.sin(elapsedTime * 0.5) * 0.15;
        shieldGroup.rotation.x = -mouseY * 0.6 + Math.cos(elapsedTime * 0.6) * 0.08;

        // Inner crest counter-spin
        crestMesh.rotation.y = elapsedTime * 1.8;
        crestMesh.rotation.z = Math.sin(elapsedTime * 1.2) * 0.2;

        // Orbit rings rotation
        ring1.rotation.z = elapsedTime * 0.4;
        ring1.rotation.x = Math.PI / 3 + Math.sin(elapsedTime * 0.5) * 0.1;

        ring2.rotation.z = -elapsedTime * 0.35;
        ring2.rotation.y = Math.PI / 4 + Math.cos(elapsedTime * 0.4) * 0.1;

        // Particle gentle drift
        particles.rotation.y = elapsedTime * 0.05;

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animId);
        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (err) {
      console.warn("WebGL initialization failed, using CSS 3D fallback:", err);
      setWebGLError(true);
    }
  }, []);

  if (webGLError) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <div className="w-52 h-64 rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-900 to-slate-950 border border-cyan-400/40 shadow-3d-glow-blue flex flex-col items-center justify-center p-6 animate-float text-white">
          <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shadow-lg mb-4">
            <span className="text-3xl">🛡️</span>
          </div>
          <p className="font-extrabold text-cyan-300 tracking-wider text-sm">TAMIL NADU POLICE</p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">BNS 2023 ENCRYPTED</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-hidden select-none pointer-events-none sm:pointer-events-auto ${className}`}
      aria-label="3D Interactive Holographic Police Shield"
    />
  );
}

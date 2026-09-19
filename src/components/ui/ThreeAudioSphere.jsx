import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function ThreeAudioSphere({
  isRecording = false,
  volume = 0,
  className = "w-44 h-44",
}) {
  const containerRef = useRef(null);
  const [webGLError, setWebGLError] = useState(false);
  const isRecordingRef = useRef(isRecording);
  const volumeRef = useRef(volume);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    volumeRef.current = volume;
  }, [isRecording, volume]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer, scene, camera, animId;
    let sphereMesh, wireframeMesh, auraRing;
    let originalPositions;

    try {
      scene = new THREE.Scene();
      const width = container.clientWidth || 180;
      const height = container.clientHeight || 180;

      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.z = 4.2;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Sphere Geometry (Icosahedron with detail for smooth deformation)
      const geometry = new THREE.IcosahedronGeometry(1.2, 4);
      originalPositions = geometry.attributes.position.clone();

      // Materials
      const coreMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0c1b3f"),
        emissive: new THREE.Color("#0284c7"),
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.8,
      });
      sphereMesh = new THREE.Mesh(geometry, coreMat);
      scene.add(sphereMesh);

      const wireframeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#38bdf8"),
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      wireframeMesh = new THREE.Mesh(geometry, wireframeMat);
      scene.add(wireframeMesh);

      // Aura Ring
      const ringGeo = new THREE.RingGeometry(1.5, 1.55, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#00f2fe"),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      });
      auraRing = new THREE.Mesh(ringGeo, ringMat);
      scene.add(auraRing);

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0x00f2fe, 3, 10);
      pointLight.position.set(2, 3, 4);
      scene.add(pointLight);

      let clock = new THREE.Clock();

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        const recording = isRecordingRef.current;
        const vol = volumeRef.current || (recording ? 0.35 : 0.05);

        // Continuous rotation
        sphereMesh.rotation.y = time * 0.4;
        wireframeMesh.rotation.y = time * 0.4;
        sphereMesh.rotation.x = time * 0.2;
        wireframeMesh.rotation.x = time * 0.2;

        auraRing.rotation.z = time * 0.8;
        const ringScale = 1 + (recording ? Math.sin(time * 6) * 0.15 + vol * 0.3 : Math.sin(time * 2) * 0.05);
        auraRing.scale.set(ringScale, ringScale, 1);

        // Deform vertices based on audio wave and time
        const positionAttr = geometry.attributes.position;
        const count = positionAttr.count;

        const waveSpeed = recording ? 8 : 2;
        const waveAmp = recording ? 0.18 + vol * 0.4 : 0.04;

        for (let i = 0; i < count; i++) {
          const u = originalPositions.getX(i);
          const v = originalPositions.getY(i);
          const w = originalPositions.getZ(i);

          const distance = Math.sqrt(u * u + v * v + w * w);
          const offset = Math.sin(distance * 4 + time * waveSpeed) * waveAmp;

          positionAttr.setXYZ(i, u * (1 + offset), v * (1 + offset), w * (1 + offset));
        }
        positionAttr.needsUpdate = true;
        geometry.computeVertexNormals();

        // Update colors depending on recording
        if (recording) {
          wireframeMat.color.set("#00f2fe");
          coreMat.emissive.set("#0284c7");
          coreMat.emissiveIntensity = 0.9;
        } else {
          wireframeMat.color.set("#60a5fa");
          coreMat.emissive.set("#1e3a8a");
          coreMat.emissiveIntensity = 0.4;
        }

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        cancelAnimationFrame(animId);
        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (err) {
      console.warn("Audio sphere WebGL error:", err);
      setWebGLError(true);
    }
  }, []);

  if (webGLError) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? "bg-rose-600 animate-ping"
              : "bg-blue-600/20 border border-blue-400/40"
          }`}
        >
          <span className="text-xl">{isRecording ? "🔴" : "🎙️"}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center select-none ${className}`}
      aria-label="3D Audio Visualizer"
    />
  );
}

import React, { useRef, useState, useCallback } from "react";

export default function Card3D({
  children,
  className = "",
  glowColor = "rgba(56, 189, 248, 0.18)",
  maxTilt = 10,
  glare = true,
  onClick,
  ...props
}) {
  const cardRef = useRef(null);
  const [coords, setCoords] = useState({ x: 0, y: 0, rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate tilt angles (in degrees)
      const rotateX = ((y - centerY) / centerY) * -maxTilt;
      const rotateY = ((x - centerX) / centerX) * maxTilt;

      setCoords({ x, y, rotateX, rotateY });
    },
    [maxTilt]
  );

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0, rotateX: 0, rotateY: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`perspective-1000 relative transition-transform duration-200 ease-out ${className}`}
      style={{
        transform: isHovered
          ? `perspective(1000px) rotateX(${coords.rotateX.toFixed(2)}deg) rotateY(${coords.rotateY.toFixed(2)}deg) translateZ(8px)`
          : "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)",
      }}
      {...props}
    >
      {/* 3D Children Content */}
      <div className="preserve-3d w-full h-full relative z-10">
        {children}
      </div>

      {/* Dynamic Cursor Specular Glare */}
      {glare && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-20 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 280px at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 70%)`,
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}

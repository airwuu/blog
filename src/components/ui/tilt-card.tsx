"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionTemplate } from "framer-motion";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> { // Extend HTMLAttributes
  children: React.ReactNode;
  className?: string;
  tiltStrength?: number;
  glareOpacity?: number;
  hoverScale?: number;
  glareColor?: string;
  disabled?: boolean;
  borderGlow?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  initial?: any; // Add Framer Motion props
  whileInView?: any;
  viewport?: any;
}

export function TiltCard({
  children,
  className = "",
  tiltStrength = 15,
  glareOpacity = 0.1,
  hoverScale = 1.02,
  glareColor = "rgba(255, 255, 255, 0.8)",
  disabled = false,
  borderGlow = false,
  onMouseEnter,
  onMouseLeave,
  initial, // Receive Framer Motion props
  whileInView,
  viewport,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isTilting, setIsTilting] = useState(false);

  // Variables to hold rotation values
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);

  // Mouse position for glare effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Track if component is mounted (for SSR)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Optimized mouse move handler using RAF
  useEffect(() => {
    if (disabled || !isMounted) return;

    let rafId: number | null = null;
    let newRotateX = 0;
    let newRotateY = 0;
    let newPosX = 0;
    let newPosY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current || !isTilting) return;

      const rect = cardRef.current.getBoundingClientRect();

      // Calculate cursor position relative to card center (from -0.5 to 0.5)
      const centerX = (e.clientX - rect.left) / rect.width - 0.5;
      const centerY = (e.clientY - rect.top) / rect.height - 0.5;

      // Calculate rotation based on cursor position and tilt strength
      newRotateX = centerY * -tiltStrength;
      newRotateY = centerX * tiltStrength;

      // Subtle movement effect (3D parallax)
      newPosX = centerX * 4;
      newPosY = centerY * 4;

      // Update glare position (inverted for realistic light effect)
      setMousePosition({
        x: centerX * 100 + 50,
        y: centerY * 100 + 50,
      });

      // Use requestAnimationFrame for smoother updates
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        setRotateX(newRotateX);
        setRotateY(newRotateY);
        setPosX(newPosX);
        setPosY(newPosY);
      });
    };

    if (isTilting) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isTilting, tiltStrength, disabled, isMounted]);

  // Reset card position when mouse leaves
  const resetCard = () => {
    setRotateX(0);
    setRotateY(0);
    setPosX(0);
    setPosY(0);
    setIsTilting(false);
    if (onMouseLeave) onMouseLeave();
  };

  // Start tilting when mouse enters
  const startTilting = () => {
    if (!disabled) {
      setIsTilting(true);
      if (onMouseEnter) onMouseEnter();
    }
  };

  // Create CSS variable for glare position
  const glarePosition = useMotionTemplate`${mousePosition.x}% ${mousePosition.y}%`;

  if (!isMounted) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={cardRef}
      className={`relative ${className}`}
      onMouseEnter={startTilting}
      onMouseLeave={resetCard}
      style={{
        transformStyle: "preserve-3d",
        transform: isTilting
          ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0) scale(${hoverScale})`
          : "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0) scale(1)",
        transition: isTilting
          ? "transform 0.1s ease-out"
          : "transform 0.3s ease-out",
        willChange: "transform",
      }}
    >
      {/* Content container with parallax effect */}
      <motion.div
        style={{
          transform: `translate(${posX}px, ${posY}px)`,
          transition: isTilting
            ? "transform 0.1s ease-out"
            : "transform 0.3s ease-out",
        }}
        className={`relative z-10 h-full w-full ${borderGlow && isTilting ? 'ring-1 ring-accent/20 shadow-lg shadow-accent/10' : ''}`}
      >
        {children}
      </motion.div>

      {/* Glare effect overlay */}
      {!disabled && glareOpacity > 0 && (
        <motion.div
          className="absolute inset-0 z-20 rounded-[inherit] pointer-events-none opacity-0 transition-opacity duration-300 overflow-hidden"
          style={{
            opacity: isTilting ? glareOpacity : 0,
            backgroundImage: `radial-gradient(circle at var(--glare-position), ${glareColor} 0%, transparent 80%)`,
            "--glare-position": glarePosition,
          } as React.CSSProperties}
        />
      )}

      {/* Border glow effect for Catppuccin theme */}
      {borderGlow && (
        <motion.div
          className="absolute inset-0 -z-10 rounded-[inherit] pointer-events-none"
          style={{
            opacity: isTilting ? 0.4 : 0,
            boxShadow: "0 0 15px 2px var(--accent)",
            transition: "opacity 0.3s ease",
          }}
        />
      )}
    </motion.div>
  );
}
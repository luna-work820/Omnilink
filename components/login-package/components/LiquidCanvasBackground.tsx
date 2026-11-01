import React, { useEffect, useRef } from "react";

export function LiquidCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawStaticAmbient = () => {
      if (!canvas) return;
      const width = (canvas.width = window.innerWidth);
      const height = (canvas.height = window.innerHeight);
      ctx.clearRect(0, 0, width, height);

      const colors = [
        "rgba(197, 65, 43, 0.06)",
        "rgba(49, 91, 255, 0.06)",
        "rgba(252, 237, 232, 0.18)",
        "rgba(238, 241, 255, 0.18)",
      ];

      for (let i = 0; i < 4; i++) {
        const x = (width / 5) * (i + 1);
        const y = height * (i % 2 === 0 ? 0.28 : 0.62);
        const radius = 220;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, colors[i % colors.length]);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawStaticAmbient();
    window.addEventListener("resize", drawStaticAmbient, { passive: true });

    return () => {
      window.removeEventListener("resize", drawStaticAmbient);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none -z-10 w-full h-full opacity-70"
    />
  );
}

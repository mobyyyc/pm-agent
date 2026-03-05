'use client';

import { useEffect, useRef } from 'react';

export default function CodeRainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Define radial lines
    const lineCount = Math.floor((canvas.width * canvas.height) / 15000);
    const lines: { angle: number; distance: number; length: number; speed: number; width: number; opacity: number; fadeIn: number }[] = [];
    const innerRadius = 300; // start roughly around the center block

    for (let i = 0; i < lineCount; i++) {
        const distance = innerRadius + Math.random() * Math.max(canvas.width, canvas.height);
        lines.push({
            angle: Math.random() * Math.PI * 2,
            distance: distance,
            length: Math.random() * 150 + 50,
            speed: Math.random() * 3 + 1.5,
            width: Math.random() * 2 + 1,
            opacity: Math.random() * 0.4 + 0.1,
            fadeIn: 1, // Start fully visible for initial ones 
        });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Calculate start and end points
        const startX = centerX + Math.cos(line.angle) * line.distance;
        const startY = centerY + Math.sin(line.angle) * line.distance;
        const endX = centerX + Math.cos(line.angle) * (line.distance + line.length);
        const endY = centerY + Math.sin(line.angle) * (line.distance + line.length);

        // Fade in effect when spawning
        if (line.fadeIn < 1) {
            line.fadeIn = Math.min(1, line.fadeIn + 0.05);
        }

        // Draw the line with a gradient
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${line.opacity * line.fadeIn})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = line.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Move line outwards
        line.distance += line.speed;

        // Reset if it goes off screen (distance > max diagonal)
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        if (line.distance > maxDist) {
          line.distance = innerRadius;
          line.angle = Math.random() * Math.PI * 2;
          line.speed = Math.random() * 3 + 1.5;
          line.fadeIn = 0; // smoothly fade in when respawned
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute left-0 top-0 w-full h-full pointer-events-none opacity-50"
      style={{ background: 'transparent' }}
    />
  );
}

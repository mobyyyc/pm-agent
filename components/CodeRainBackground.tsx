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

    // Define lines
    const lineCount = Math.floor(canvas.width / 20);
    const lines: { x: number; y: number; length: number; speed: number; width: number; opacity: number }[] = [];

    for (let i = 0; i < lineCount; i++) {
      lines.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * -1,
        length: Math.random() * 150 + 50,
        speed: Math.random() * 2 + 1,
        width: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Draw the line with a gradient
        const gradient = ctx.createLinearGradient(line.x, line.y, line.x, line.y + line.length);
        gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${line.opacity})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(line.x, line.y, line.width, line.length);

        // Move line down
        line.y += line.speed;

        // Reset if it goes off screen
        if (line.y > canvas.height) {
          line.y = -line.length;
          line.x = Math.random() * canvas.width;
          line.speed = Math.random() * 2 + 1;
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

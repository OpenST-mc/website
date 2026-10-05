import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import creditsMd from '../../content/credits.md?raw';
import './credits.css';

interface Star {
  x: number;
  y: number;
  z: number;
  s: number;
}

// Credits（/profile/april/december）：星空 canvas + Markdown 致谢 + 入场遮罩。
export default function Page() {
  const [portalMounted, setPortalMounted] = useState(true);
  const [portalFade, setPortalFade] = useState(false);
  const [html, setHtml] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Markdown 仅在客户端解析净化（避免 SSR 依赖 DOM）。
  useEffect(() => {
    try {
      const safe = DOMPurify.sanitize(String(marked.parse(creditsMd)));
      setHtml(safe + '<a href="https://openstmc.com" class="back-home">BACK TO ARCHIVE</a>');
    } catch {
      setHtml("<h2>OpenST Credits</h2><a href='https://openstmc.com' class='back-home'>RETURN</a>");
    }
  }, []);

  // 星空动画：初始化与卸载清理均在此 effect 内。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let stars: Star[] = [];
    let raf = 0;

    const initStars = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const starCount = window.innerWidth < 768 ? 800 : 1800;
      stars = Array.from({ length: starCount }, (): Star => ({
        x: (Math.random() - 0.5) * window.innerWidth * 2.5,
        y: (Math.random() - 0.5) * window.innerHeight * 2.5,
        z: Math.random() * window.innerWidth,
        s: Math.random() * 1.2 + 0.3,
      }));
    };

    const animate = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      stars.forEach((s) => {
        s.z -= 0.3;
        if (s.z <= 0) s.z = window.innerWidth;
        const k = 400 / s.z;
        const px = s.x * k + window.innerWidth / 2;
        const py = s.y * k + window.innerHeight / 2;

        if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) {
          const size = (1 - s.z / window.innerWidth) * s.s;
          ctx.fillStyle = `rgba(255,255,255,${(1 - s.z / window.innerWidth) * 0.7})`;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      raf = window.requestAnimationFrame(animate);
    };

    initStars();
    animate();
    window.addEventListener('resize', initStars);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', initStars);
    };
  }, []);

  return (
    <>
      {portalMounted ? (
        <div
          id="portal"
          style={portalFade ? { opacity: 0 } : undefined}
          onClick={() => {
            setPortalFade(true);
            window.setTimeout(() => setPortalMounted(false), 1000);
          }}
        >
          <div className="portal-btn">INIT OPENST</div>
        </div>
      ) : null}

      <canvas id="starfield" ref={canvasRef} />
      <div className="fade-overlay" />
      <div id="credits-wrap" className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

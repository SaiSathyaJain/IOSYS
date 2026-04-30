import { useState, useEffect } from 'react';
import './BuddhaPurnima.css';

export default function BuddhaPurnima() {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const canvas = document.getElementById('bp-petals-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const resize = () => {
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const PETAL_COUNT = 30;
        const petals = Array.from({ length: PETAL_COUNT }, () => ({
            x:       Math.random() * window.innerWidth,
            y:       Math.random() * window.innerHeight - window.innerHeight,
            r:       7 + Math.random() * 11,
            speed:   0.5 + Math.random() * 0.9,
            drift:   (Math.random() - 0.5) * 0.5,
            spin:    (Math.random() - 0.5) * 0.035,
            angle:   Math.random() * Math.PI * 2,
            opacity: 0.10 + Math.random() * 0.16,
        }));

        let raf;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            petals.forEach(p => {
                p.y     += p.speed;
                p.x     += p.drift;
                p.angle += p.spin;
                if (p.y > canvas.height + 20) {
                    p.y = -20;
                    p.x = Math.random() * canvas.width;
                }
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.globalAlpha = p.opacity;
                // Outer petal
                ctx.beginPath();
                ctx.ellipse(0, -p.r * 0.55, p.r * 0.42, p.r, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#f9a8d4';
                ctx.fill();
                // Inner highlight
                ctx.beginPath();
                ctx.ellipse(0, -p.r * 0.55, p.r * 0.22, p.r * 0.55, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#fce7f3';
                ctx.fill();
                ctx.restore();
            });
            raf = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <>
            <canvas id="bp-petals-canvas" className="bp-canvas" />
            {!dismissed && (
                <div className="bp-banner">
                    <span className="bp-glow" />
                    <span className="bp-lotus">🪷</span>
                    <div className="bp-text">
                        <span className="bp-title">Sai Ram — Buddha Purnima Greetings</span>
                        <span className="bp-sub">May the light of the Enlightened One guide us with wisdom, peace and compassion.</span>
                    </div>
                    <button className="bp-dismiss" onClick={() => setDismissed(true)} title="Dismiss">✕</button>
                </div>
            )}
        </>
    );
}

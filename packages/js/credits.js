// Credits 页脚本：星空动画与致谢内容加载
const wrap = document.getElementById('credits-wrap');
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
let stars = [];

document.getElementById('portal').addEventListener('click', function () {
    this.style.opacity = '0';
    setTimeout(() => this.remove(), 1000);
});

async function loadCredits() {
    try {
        const res = await fetch('./credits.md');
        const md = await res.text();
        // DOMPurify 净化，防止 XSS
        const safeHtml = DOMPurify.sanitize(marked.parse(md));
        wrap.innerHTML = safeHtml + '<a href="https://openstmc.com" class="back-home">BACK TO ARCHIVE</a>';
    } catch (e) {
        wrap.innerHTML = "<h2>OpenST Credits</h2><a href='https://openstmc.com' class='back-home'>RETURN</a>";
    }
}

function initStars() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const starCount = window.innerWidth < 768 ? 800 : 1800;

    stars = Array(starCount).fill().map(() => ({
        x: (Math.random() - 0.5) * window.innerWidth * 2.5,
        y: (Math.random() - 0.5) * window.innerHeight * 2.5,
        z: Math.random() * window.innerWidth,
        s: Math.random() * 1.2 + 0.3
    }));
}

function animateStars() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    stars.forEach(s => {
        s.z -= 0.3;
        if(s.z <= 0) s.z = window.innerWidth;
        let k = 400 / s.z;
        let px = s.x * k + window.innerWidth / 2;
        let py = s.y * k + window.innerHeight / 2;

        if (px >= 0 && px <= window.innerWidth && py >= 0 && py <= window.innerHeight) {
            let size = (1 - s.z / window.innerWidth) * s.s;
            ctx.fillStyle = `rgba(255,255,255,${(1 - s.z / window.innerWidth) * 0.7})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    requestAnimationFrame(animateStars);
}

window.addEventListener('resize', initStars);
initStars();
animateStars();
loadCredits();

// Smooth scrolling for navigation links
document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Intersection Observer for scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    observer.observe(section);
});

// Form submission handler
document.querySelector('#contact form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="email"]').value;
    if (email) {
        alert(`Thank you for your interest! We'll send a free security assessment to ${email} shortly.`);
        this.reset();
    } else {
        alert('Please enter a valid email address.');
    }
});

// Add some interactive effects
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effect to feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-15px) scale(1.02)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Typing effect for hero title
    const heroTitle = document.querySelector('#hero h2');
    const originalText = heroTitle.textContent;
    const words = originalText.split(' ');
    heroTitle.innerHTML = words.map(word => `<span class="word">${word.split('').map(letter => `<span class="letter" style="display:none">${letter}</span>`).join('')}</span>`).join('&nbsp;');
    const letterSpans = heroTitle.querySelectorAll('.letter');
    let i = 0;
    const typeWriter = () => {
        if (i < letterSpans.length) {
            letterSpans[i].style.display = 'inline-block';
            i++;
            setTimeout(typeWriter, 100);
        }
    };
    setTimeout(typeWriter, 1000);

    // Prepare subtitle for animation
    const heroP = document.querySelector('#hero p');
    const pText = heroP.textContent;
    heroP.innerHTML = pText.split('').map(letter => letter === ' ' ? '&nbsp;' : `<span class="letter">${letter}</span>`).join('');

    // Parallax effect for hero background
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('#hero');
        if (hero) {
            hero.style.backgroundPositionY = -(scrolled * 0.5) + 'px';
        }
    });

    // Mobile menu toggle (if needed in future)
    // For now, the nav is responsive enough
});

// Particle system for lambda cursor trail
class Particle {
    constructor(x, y) {
        // Add randomness to position
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 20;
        // More varied velocity
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        // More varied size
        this.size = Math.random() * 30 + 5;
        this.originalSize = this.size;
        this.life = 1;
        this.decay = Math.random() * 0.03 + 0.005;
        this.element = document.createElement('div');
        this.element.className = 'lambda-particle';
        this.element.textContent = 'λ';
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.fontSize = this.size + 'px';
        document.body.appendChild(this.element);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size = this.originalSize * this.life;
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.fontSize = this.size + 'px';
        this.element.style.opacity = this.life;
        if (this.life <= 0) {
            this.element.remove();
            return true; // remove particle
        }
        return false;
    }

    swell() {
        this.size *= 2;
        this.element.style.fontSize = this.size + 'px';
        this.decay *= 0.5; // slower decay
    }
}

const particles = [];
let mouseX = 0;
let mouseY = 0;
let hoverX = 0;
let hoverY = 0;
let hovering = false;
let lastParticleTime = 0;
const particleInterval = 20; // ms between particles
const maxParticles = 100;

// Select clickable elements
const clickableElements = document.querySelectorAll('a, button, input[type="submit"], .cta-button, .feature-card, .project-card, .testimonial');

clickableElements.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
        hovering = true;
        hoverX = e.pageX;
        hoverY = e.pageY;
    });
    el.addEventListener('mouseleave', () => {
        hovering = false;
    });
});

document.addEventListener('mousemove', (e) => {
    mouseX = e.pageX;
    mouseY = e.pageY;
    if (hovering) {
        hoverX = mouseX;
        hoverY = mouseY;
    }
    const now = Date.now();
    if (now - lastParticleTime > particleInterval && particles.length < maxParticles) {
        // Add new particle
        particles.push(new Particle(mouseX, mouseY));
        lastParticleTime = now;
    }
});

document.addEventListener('click', () => {
    // Swell all particles
    particles.forEach(particle => particle.swell());
});

function animate() {
    const now = Date.now();
    // Emit particles on hover even without mouse move
    if (hovering && now - lastParticleTime > particleInterval && particles.length < maxParticles) {
        particles.push(new Particle(hoverX, hoverY));
        lastParticleTime = now;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].update()) {
            particles.splice(i, 1);
        }
    }
    requestAnimationFrame(animate);
}

animate();

// Proximity animation for hero text letters
let proxMouseX = 0;
let proxMouseY = 0;
let lastUpdate = 0;
const updateInterval = 50; // ms

document.addEventListener('mousemove', (e) => {
    proxMouseX = e.clientX;
    proxMouseY = e.clientY;
});

function updateLetters() {
    const now = Date.now();
    if (now - lastUpdate > updateInterval) {
        const h2 = document.querySelector('#hero h2');
        const p = document.querySelector('#hero p');
        const h2Letters = h2.querySelectorAll('.letter');
        const pLetters = p.querySelectorAll('.letter');
        const allLetters = [...h2Letters, ...pLetters];
        allLetters.forEach(span => {
            if (span.style.display !== 'none') {
                const rect = span.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dx = centerX - proxMouseX;
                const dy = centerY - proxMouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 200;
                const factor = Math.max(0, 1 - distance / maxDist);
                const scale = 0.8 + factor * 0.4; // from 0.8 to 1.2
                const opacity = 0.5 + factor * 0.5; // from 0.5 to 1
                const moveX = (dx / distance) * factor * 15; // repel up to 15px
                const moveY = (dy / distance) * factor * 15;
                span.style.transform = `translate(${moveX}px, ${moveY}px) scale(${scale})`;
                span.style.opacity = opacity;
            }
        });
        lastUpdate = now;
    }
    requestAnimationFrame(updateLetters);
}

requestAnimationFrame(updateLetters);

// Add loading animation
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
});

// CSS for loaded state and particles
const style = document.createElement('style');
style.textContent = `
body.loaded section {
    opacity: 1;
    transform: translateY(0);
}

.lambda-particle {
    position: absolute;
    pointer-events: none;
    color: #007bff;
    font-weight: bold;
    z-index: 9999;
    transition: none;
}

.scattered-sprite {
    animation: float 6s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}
`;
document.head.appendChild(style);

// Sprite scattering code
const spriteImage = new Image();
spriteImage.onload = function() {
    const W = spriteImage.width;
    const H = spriteImage.height;
    const border = 20;
    const gap = 20;
    const usableW = W - 2 * border;
    const usableH = H - 2 * border;
    const imgW = (usableW - 2 * gap) / 3;
    const rowH = (usableH - gap) / 2;
    const sprites = [
        { x: border, y: border, w: imgW, h: usableH }, // sprite 1: spans 2 rows
        { x: border + imgW + gap, y: border, w: imgW, h: rowH }, // sprite 2
        { x: border + 2 * imgW + 2 * gap, y: border, w: imgW, h: rowH }, // sprite 3
        { x: border + imgW + gap, y: border + rowH + gap, w: imgW, h: rowH }, // sprite 4
        { x: border + 2 * imgW + 2 * gap, y: border + rowH + gap, w: imgW, h: rowH } // sprite 5
    ];
    // Scatter in sections (excluding hero)
    const sections = ['features', 'about', 'projects', 'testimonials', 'contact'];
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            const numSprites = Math.random() < 0.5 ? 1 : 2; // 1 or 2 sprites per section
            for (let i = 0; i < numSprites; i++) {
                const sprite = sprites[Math.floor(Math.random() * sprites.length)];
                const div = document.createElement('div');
                div.className = 'scattered-sprite';
                div.style.backgroundImage = `url('ai.png')`;
                div.style.backgroundSize = `${W}px ${H}px`;
                div.style.backgroundPosition = `-${sprite.x}px -${sprite.y}px`;
                div.style.width = `${sprite.w * 0.6}px`; // scale down
                div.style.height = `${sprite.h * 0.6}px`;
                div.style.position = 'absolute';
                // Position in edges/corners to avoid blocking text
                const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                const pos = positions[Math.floor(Math.random() * positions.length)];
                switch (pos) {
                    case 'top-left':
                        div.style.left = '5%';
                        div.style.top = '5%';
                        break;
                    case 'top-right':
                        div.style.right = '5%';
                        div.style.top = '5%';
                        break;
                    case 'bottom-left':
                        div.style.left = '5%';
                        div.style.bottom = '5%';
                        break;
                    case 'bottom-right':
                        div.style.right = '5%';
                        div.style.bottom = '5%';
                        break;
                }
                div.style.opacity = '0.15'; // more subtle
                div.style.pointerEvents = 'none';
                div.style.zIndex = '-1'; // behind content
                section.style.position = 'relative';
                section.appendChild(div);
            }
        }
    });
};
spriteImage.src = 'ai.png';

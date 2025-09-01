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

// No form in contact, just mailto link

// Solar System Proximity Detection
document.addEventListener('DOMContentLoaded', function() {
    const planets = document.querySelectorAll('.planet');
    const panelCompany = document.getElementById('panel-company');
    const panelPeriod = document.getElementById('panel-period');
    const panelDescription = document.getElementById('panel-description');
    const solarSystem = document.querySelector('.solar-system');
    let currentNearestPlanet = null;

    // Proximity detection
    document.addEventListener('mousemove', function(e) {
        if (!solarSystem) return;

        const solarRect = solarSystem.getBoundingClientRect();
        const mouseX = e.clientX - solarRect.left;
        const mouseY = e.clientY - solarRect.top;

        // Check if mouse is within solar system bounds
        if (mouseX < 0 || mouseX > solarRect.width || mouseY < 0 || mouseY > solarRect.height) {
            // Reset all planets and panel
            planets.forEach(planet => {
                planet.classList.remove('near');
            });
            if (currentNearestPlanet) {
                panelCompany.textContent = 'Hover over a planet to explore';
                panelPeriod.textContent = '';
                panelDescription.textContent = 'Move your mouse around the solar system to discover my professional journey through the years.';
                currentNearestPlanet = null;
            }
            return;
        }

        let nearestPlanet = null;
        let nearestDistance = Infinity;

        planets.forEach(planet => {
            const planetRect = planet.getBoundingClientRect();
            const planetCenterX = planetRect.left + planetRect.width / 2 - solarRect.left;
            const planetCenterY = planetRect.top + planetRect.height / 2 - solarRect.top;

            const distance = Math.sqrt(
                Math.pow(mouseX - planetCenterX, 2) +
                Math.pow(mouseY - planetCenterY, 2)
            );

            // Proximity threshold (adjust as needed)
            const proximityThreshold = 100;

            if (distance < proximityThreshold && distance < nearestDistance) {
                nearestDistance = distance;
                nearestPlanet = planet;
            }

            // Add/remove near class for scaling effect
            if (distance < proximityThreshold) {
                planet.classList.add('near');
            } else {
                planet.classList.remove('near');
            }
        });

        // Update panel if nearest planet changed
        if (nearestPlanet !== currentNearestPlanet) {
            if (nearestPlanet) {
                const company = nearestPlanet.dataset.company;
                const period = nearestPlanet.dataset.period;
                const description = nearestPlanet.dataset.description;

                panelCompany.textContent = company;
                panelPeriod.textContent = period;
                panelDescription.textContent = description;
            } else {
                panelCompany.textContent = 'Hover over a planet to explore';
                panelPeriod.textContent = '';
                panelDescription.textContent = 'Move your mouse around the solar system to discover my professional journey through the years.';
            }
            currentNearestPlanet = nearestPlanet;
        }
    });

    // Add hover effect to interactive elements
    const interactiveElements = document.querySelectorAll('.tech-category, .project-card, .education-item');
    interactiveElements.forEach(card => {
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

    // Solar system background stars
    createStars();

    // Mobile menu toggle (if needed in future)
    // For now, the nav is responsive enough
});

// Create animated stars for solar system background
function createStars() {
    const experienceSection = document.getElementById('experience');
    const solarSystem = document.querySelector('.solar-system');

    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        solarSystem.appendChild(star);
    }
}

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
        this.element.className = 'code-particle';
        const symbols = ['<>', '{}', '[]', '()', '/*', '*/', '=>', '::', ';;', '&&', '||'];
        this.element.textContent = symbols[Math.floor(Math.random() * symbols.length)];
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
let lastParticleTime = 0;
const particleInterval = 50; // ms between particles (increased for less intensity)
const maxParticles = 50; // reduced max particles

// Select clickable elements for click effect only
const clickableElements = document.querySelectorAll('a, button, input[type="submit"], .cta-button');

document.addEventListener('mousemove', (e) => {
    mouseX = e.pageX;
    mouseY = e.pageY;
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

.code-particle {
    position: absolute;
    pointer-events: none;
    color: #17a2b8;
    font-weight: bold;
    z-index: 9999;
    transition: none;
}

`;
document.head.appendChild(style);

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

    // Neural network initialization
    initializeNeuralNetwork();

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

// Force Directed Graph Initialization
function initializeNeuralNetwork() {
    const svg = document.querySelector('.graph-svg');
    if (!svg) {
        console.error('SVG element not found');
        return;
    }

    const width = 1200;
    const height = 600;

    // Define the graph data with more comprehensive skills
    const nodes = [
        // Core skill groups
        { id: 'Backend', group: 'Backend', type: 'core', description: '.NET Core, Node.js, GraphQL, Event Sourcing, CQRS, Pub/Sub, Terraform, Serverless, Clouds (AWS, Azure, GCP), Air-gapped systems', x: width/2 - 200, y: height/2 },
        { id: 'Frontend', group: 'Frontend', type: 'core', description: 'React, Redux, Webpack, Storybook, Testing: Mocha, Jasmine, Cypress, Authentication: OIDC, OAuth', x: width/2 + 200, y: height/2 },
        { id: 'AI/ML', group: 'AI/ML', type: 'core', description: 'Vision: YOLO, DETR-ResNet, ONNX Integration, LLMs, Ollama, Autonomous Agents, RAG', x: width/2, y: height/2 - 150 },
        { id: 'Languages', group: 'Languages', type: 'core', description: 'C#, F#, TypeScript, JavaScript, Rust, SQL, Python, Scala, Java', x: width/2, y: height/2 + 150 },
        { id: 'Other', group: 'Other', type: 'core', description: 'WebGPU, GStreamer, Docker, 3D: Volume Raycasting, React Three Fiber', x: width/2 - 300, y: height/2 + 100 },

        // Individual skills
        { id: '.NET Core', group: 'Backend', type: 'leaf', description: 'Primary backend framework for enterprise applications', x: width/2 - 100, y: height/2 + 50 },
        { id: 'Node.js', group: 'Backend', type: 'leaf', description: 'JavaScript runtime for server-side development', x: width/2 - 150, y: height/2 - 50 },
        { id: 'GraphQL', group: 'Backend', type: 'leaf', description: 'Query language for APIs', x: width/2 - 250, y: height/2 },
        { id: 'React', group: 'Frontend', type: 'leaf', description: 'Modern JavaScript library for building user interfaces', x: width/2 + 100, y: height/2 + 50 },
        { id: 'Redux', group: 'Frontend', type: 'leaf', description: 'State management for React applications', x: width/2 + 150, y: height/2 - 50 },
        { id: 'TypeScript', group: 'Frontend', type: 'leaf', description: 'Typed superset of JavaScript', x: width/2 + 250, y: height/2 },
        { id: 'YOLO', group: 'AI/ML', type: 'leaf', description: 'Real-time object detection system', x: width/2 + 50, y: height/2 - 100 },
        { id: 'Python', group: 'AI/ML', type: 'leaf', description: 'Primary language for machine learning', x: width/2 - 50, y: height/2 - 100 },
        { id: 'Rust', group: 'Languages', type: 'leaf', description: 'Systems programming language', x: width/2 + 50, y: height/2 + 100 },
        { id: 'C#', group: 'Languages', type: 'leaf', description: 'Object-oriented programming language', x: width/2 - 50, y: height/2 + 100 },
        { id: 'Docker', group: 'Other', type: 'leaf', description: 'Containerization platform', x: width/2 - 200, y: height/2 + 150 },
        { id: 'WebGPU', group: 'Other', type: 'leaf', description: 'Modern graphics API for the web', x: width/2 - 350, y: height/2 + 50 },

        // Additional skills for more connections
        { id: 'JavaScript', group: 'Languages', type: 'leaf', description: 'Core web programming language', x: width/2 + 100, y: height/2 + 120 },
        { id: 'SQL', group: 'Languages', type: 'leaf', description: 'Database query language', x: width/2 - 100, y: height/2 + 120 },
        { id: 'AWS', group: 'Backend', type: 'leaf', description: 'Cloud computing platform', x: width/2 - 300, y: height/2 - 50 },
        { id: 'Azure', group: 'Backend', type: 'leaf', description: 'Microsoft cloud platform', x: width/2 - 350, y: height/2 },
        { id: 'Terraform', group: 'Backend', type: 'leaf', description: 'Infrastructure as code tool', x: width/2 - 400, y: height/2 + 50 },
        { id: 'Webpack', group: 'Frontend', type: 'leaf', description: 'Module bundler for JavaScript', x: width/2 + 300, y: height/2 + 50 },
        { id: 'Storybook', group: 'Frontend', type: 'leaf', description: 'UI component development tool', x: width/2 + 350, y: height/2 },
        { id: 'ONNX', group: 'AI/ML', type: 'leaf', description: 'Open Neural Network Exchange format', x: width/2 - 100, y: height/2 - 200 },
        { id: 'LLMs', group: 'AI/ML', type: 'leaf', description: 'Large Language Models', x: width/2 + 100, y: height/2 - 200 },
        { id: 'Volume Raycasting', group: 'Other', type: 'leaf', description: '3D volume visualization technique', x: width/2 - 450, y: height/2 + 100 },
        { id: 'React Three Fiber', group: 'Other', type: 'leaf', description: 'React renderer for Three.js', x: width/2 - 400, y: height/2 + 150 }
    ];

    const links = [
        // Connect core groups to their skills
        { source: 'Backend', target: '.NET Core' },
        { source: 'Backend', target: 'Node.js' },
        { source: 'Backend', target: 'GraphQL' },
        { source: 'Backend', target: 'AWS' },
        { source: 'Backend', target: 'Azure' },
        { source: 'Backend', target: 'Terraform' },
        { source: 'Backend', target: 'Docker' },
        { source: 'Frontend', target: 'React' },
        { source: 'Frontend', target: 'Redux' },
        { source: 'Frontend', target: 'TypeScript' },
        { source: 'Frontend', target: 'Webpack' },
        { source: 'Frontend', target: 'Storybook' },
        { source: 'Frontend', target: 'JavaScript' },
        { source: 'AI/ML', target: 'YOLO' },
        { source: 'AI/ML', target: 'Python' },
        { source: 'AI/ML', target: 'ONNX' },
        { source: 'AI/ML', target: 'LLMs' },
        { source: 'AI/ML', target: 'WebGPU' },
        { source: 'Languages', target: 'Rust' },
        { source: 'Languages', target: 'C#' },
        { source: 'Languages', target: 'TypeScript' },
        { source: 'Languages', target: 'JavaScript' },
        { source: 'Languages', target: 'Python' },
        { source: 'Languages', target: 'SQL' },
        { source: 'Other', target: 'Docker' },
        { source: 'Other', target: 'WebGPU' },
        { source: 'Other', target: 'Volume Raycasting' },
        { source: 'Other', target: 'React Three Fiber' },

        // Cross-connections between skills
        { source: 'TypeScript', target: 'JavaScript' },
        { source: 'React', target: 'JavaScript' },
        { source: 'Node.js', target: 'JavaScript' },
        { source: 'React', target: 'TypeScript' },
        { source: 'Node.js', target: 'TypeScript' },
        { source: 'Python', target: 'AI/ML' },
        { source: 'Docker', target: 'Backend' },
        { source: 'WebGPU', target: 'Other' },
        { source: 'Volume Raycasting', target: 'WebGPU' },
        { source: 'React Three Fiber', target: 'React' },
        { source: 'React Three Fiber', target: 'WebGPU' },
        { source: 'YOLO', target: 'Python' },
        { source: 'ONNX', target: 'Python' },
        { source: 'LLMs', target: 'Python' },
        { source: 'SQL', target: 'Backend' },
        { source: 'C#', target: '.NET Core' },
        { source: 'Rust', target: 'WebGPU' },
        { source: 'Webpack', target: 'JavaScript' },
        { source: 'Storybook', target: 'React' },
        { source: 'AWS', target: 'Terraform' },
        { source: 'Azure', target: 'Terraform' },
        { source: 'GraphQL', target: 'Node.js' },
        { source: 'Redux', target: 'React' },

        // Additional cross-domain connections
        { source: 'AI/ML', target: 'Backend' },
        { source: 'AI/ML', target: 'Frontend' },
        { source: 'Frontend', target: 'Backend' },
        { source: 'Other', target: 'AI/ML' },
        { source: 'Other', target: 'Frontend' }
    ];

    // Create force simulation with better parameters for more interconnected graph
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
            // Different distances based on connection type
            if (d.source.type === 'core' && d.target.type === 'core') return 200; // core to core
            if (d.source.type === 'core' || d.target.type === 'core') return 120; // core to leaf
            return 80; // leaf to leaf
        }).strength(d => {
            // Stronger links for core connections, weaker for cross-domain
            if (d.source.group === d.target.group) return 0.8; // same group
            if (d.source.type === 'core' && d.target.type === 'core') return 0.3; // core cross-domain
            return 0.5; // mixed connections
        }))
        .force('charge', d3.forceManyBody().strength(d => d.type === 'core' ? -1200 : -600))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', d3.forceCollide().radius(d => d.type === 'core' ? 45 : 30).strength(0.9))
        .force('x', d3.forceX(d => {
            // Position core groups in a circle
            const coreGroups = ['Backend', 'Frontend', 'AI/ML', 'Languages', 'Other'];
            const index = coreGroups.indexOf(d.group);
            if (index !== -1) {
                const angle = (index / coreGroups.length) * 2 * Math.PI;
                return width/2 + Math.cos(angle) * 250;
            }
            return width/2;
        }).strength(d => d.type === 'core' ? 0.3 : 0.1))
        .force('y', d3.forceY(d => {
            const coreGroups = ['Backend', 'Frontend', 'AI/ML', 'Languages', 'Other'];
            const index = coreGroups.indexOf(d.group);
            if (index !== -1) {
                const angle = (index / coreGroups.length) * 2 * Math.PI;
                return height/2 + Math.sin(angle) * 150;
            }
            return height/2;
        }).strength(d => d.type === 'core' ? 0.3 : 0.1))
        .velocityDecay(0.6)
        .alphaDecay(0.01);

    // Create links
    const link = d3.select('.links')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('class', 'link')
        .attr('stroke-width', 2);

    // Create nodes
    const node = d3.select('.nodes')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .attr('class', d => `node ${d.type}`)
        .attr('data-group', d => d.group)
        .attr('data-skill', d => d.id)
        .attr('data-description', d => d.description)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // Add circles to nodes
    node.append('circle')
        .attr('class', 'node-circle')
        .attr('r', d => d.type === 'core' ? 25 : 15)
        .attr('fill', d => {
            const colors = {
                'Backend': '#ff6b35',
                'Frontend': '#4ecdc4',
                'AI/ML': '#45b7d1',
                'Languages': '#f9ca24',
                'Other': '#6c5ce7'
            };
            return colors[d.group] || '#4a90e2';
        });

    // Add labels to nodes
    node.append('text')
        .attr('class', 'node-label')
        .attr('text-anchor', 'middle')
        .attr('dy', d => d.type === 'core' ? '0.35em' : '1.5em')
        .attr('font-size', d => d.type === 'core' ? '14px' : '12px')
        .attr('font-weight', d => d.type === 'core' ? 'bold' : 'normal')
        .text(d => d.id);

    // Update positions on simulation tick
    simulation.on('tick', () => {
        // Keep nodes within bounds
        nodes.forEach(d => {
            d.x = Math.max(30, Math.min(width - 30, d.x));
            d.y = Math.max(30, Math.min(height - 30, d.y));
        });

        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Hover interactions with proximity detection
    const skillsPanelTitle = document.getElementById('skills-panel-title');
    const skillsPanelDescription = document.getElementById('skills-panel-description');
    let hoveredNode = null;

    // Mouse move proximity detection
    svg.addEventListener('mousemove', function(event) {
        const rect = svg.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let closestNode = null;
        let minDistance = 60; // Proximity threshold

        nodes.forEach(d => {
            const distance = Math.sqrt((d.x - mouseX) ** 2 + (d.y - mouseY) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                closestNode = d;
            }
        });

        if (closestNode !== hoveredNode) {
            if (hoveredNode) {
                // Reset previous hover - remove visual effects
                node.filter(d => d === hoveredNode)
                    .select('circle')
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 2)
                    .style('filter', 'none');

                node.filter(d => d === hoveredNode)
                    .select('text')
                    .transition()
                    .duration(200)
                    .style('opacity', 0);

                link.classed('active', false);
            }

            hoveredNode = closestNode;

            if (hoveredNode) {
                // Set new hover - add visual effects
                node.filter(d => d === hoveredNode)
                    .select('circle')
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 4)
                    .style('filter', 'drop-shadow(0 0 10px rgba(23, 162, 184, 0.8))');

                node.filter(d => d === hoveredNode)
                    .select('text')
                    .transition()
                    .duration(200)
                    .style('opacity', 1)
                    .style('fill', '#17a2b8')
                    .style('font-weight', 'bold');

                link.classed('active', l => l.source === hoveredNode || l.target === hoveredNode);

                skillsPanelTitle.textContent = hoveredNode.id;
                skillsPanelDescription.textContent = hoveredNode.description;
            } else {
                skillsPanelTitle.textContent = 'Hover over nodes to explore';
                skillsPanelDescription.textContent = 'Navigate the force-directed graph to discover my technical expertise and skills.';
            }
        }
    });

    // Mouse leave reset
    svg.addEventListener('mouseleave', function() {
        if (hoveredNode) {
            // Reset hover effects
            node.filter(d => d === hoveredNode)
                .select('circle')
                .transition()
                .duration(200)
                .attr('stroke-width', 2)
                .style('filter', 'none');

            node.filter(d => d === hoveredNode)
                .select('text')
                .transition()
                .duration(200)
                .style('opacity', 0);

            link.classed('active', false);

            hoveredNode = null;
            skillsPanelTitle.textContent = 'Hover over nodes to explore';
            skillsPanelDescription.textContent = 'Navigate the force-directed graph to discover my technical expertise and skills.';
        }
    });

    // Stabilize simulation after a few seconds
    setTimeout(() => {
        simulation.alphaTarget(0).restart();
    }, 3000);
}

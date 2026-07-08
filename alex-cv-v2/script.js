/* ── Utilities ─────────────────────────────────────────────── */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EMAIL = 'alex.lambdasafe@gmail.com';

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

/* ── Year ──────────────────────────────────────────────────── */
document.getElementById('year').textContent = new Date().getFullYear();

/* ── Smooth nav + mobile menu ──────────────────────────────── */
const burger = document.getElementById('burger-menu');
const navMenu = document.getElementById('nav-menu');
const header = document.querySelector('header');

burger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = burger.classList.toggle('active');
    navMenu.classList.toggle('active', open);
    burger.setAttribute('aria-expanded', String(open));
});

document.addEventListener('click', (e) => {
    if (!burger?.contains(e.target) && !navMenu?.contains(e.target)) {
        burger?.classList.remove('active');
        navMenu?.classList.remove('active');
        burger?.setAttribute('aria-expanded', 'false');
    }
});

document.querySelectorAll('nav a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        burger?.classList.remove('active');
        navMenu?.classList.remove('active');
        burger?.setAttribute('aria-expanded', 'false');
    });
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        burger?.classList.remove('active');
        navMenu?.classList.remove('active');
        burger?.setAttribute('aria-expanded', 'false');
    }
});

/* ── Scroll progress + header + active nav ─────────────────── */
const progressBar = document.getElementById('scroll-progress');
const sectionIds = ['hero', 'experience', 'technologies', 'projects', 'education', 'contact'];
const navLinks = document.querySelectorAll('nav a[data-section]');

function onScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressBar) progressBar.style.width = `${pct}%`;

    header?.classList.toggle('scrolled', scrollTop > 20);

    let current = 'hero';
    for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
    }
    navLinks.forEach((link) => {
        link.classList.toggle('active', link.dataset.section === current);
    });
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ── Reveal on scroll ──────────────────────────────────────── */
const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 6, 5) * 0.06}s`;
    revealObserver.observe(el);
});

/* ── Cursor glow ───────────────────────────────────────────── */
const cursorGlow = document.getElementById('cursor-glow');
if (cursorGlow && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    let gx = 0, gy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', (e) => {
        tx = e.clientX;
        ty = e.clientY;
    }, { passive: true });

    (function tickGlow() {
        gx += (tx - gx) * 0.12;
        gy += (ty - gy) * 0.12;
        cursorGlow.style.left = `${gx}px`;
        cursorGlow.style.top = `${gy}px`;
        requestAnimationFrame(tickGlow);
    })();
}

/* ── Starfield canvas ──────────────────────────────────────── */
(function initStarfield() {
    const canvas = document.getElementById('starfield');
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    let w = 0, h = 0, dpr = 1;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const count = Math.floor((w * h) / 9000);
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1.4 + 0.2,
            a: Math.random(),
            s: Math.random() * 0.4 + 0.1,
            tw: Math.random() * Math.PI * 2,
            sp: Math.random() * 0.02 + 0.005,
        }));
    }

    let mx = 0.5, my = 0.5;
    window.addEventListener('mousemove', (e) => {
        mx = e.clientX / w;
        my = e.clientY / h;
    }, { passive: true });

    function draw() {
        ctx.clearRect(0, 0, w, h);
        const ox = (mx - 0.5) * 18;
        const oy = (my - 0.5) * 12;

        for (const star of stars) {
            star.tw += star.sp;
            const alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(star.tw));
            ctx.beginPath();
            ctx.arc(star.x + ox * star.s, star.y + oy * star.s, star.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 230, 255, ${alpha * star.a})`;
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
})();

/* ── Hero counters ─────────────────────────────────────────── */
(function initCounters() {
    const stats = document.querySelectorAll('.stat-value[data-count]');
    if (!stats.length) return;

    const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            if (reduceMotion) {
                el.textContent = target;
                obs.unobserve(el);
                return;
            }
            const start = performance.now();
            const duration = 1400;
            function step(now) {
                const t = clamp((now - start) / duration, 0, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                el.textContent = Math.round(target * eased);
                if (t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
            obs.unobserve(el);
        });
    }, { threshold: 0.5 });

    stats.forEach((s) => obs.observe(s));
})();

/* ── Magnetic buttons ──────────────────────────────────────── */
if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.magnetic').forEach((btn) => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.18}px, ${y * 0.22}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}

/* ── Timeline accordion ────────────────────────────────────── */
document.querySelectorAll('.timeline-item').forEach((item) => {
    const accent = item.dataset.accent;
    if (accent) item.style.setProperty('--item-accent', accent);

    const btn = item.querySelector('.timeline-node');
    btn?.addEventListener('click', () => {
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.timeline-item.open').forEach((other) => {
            other.classList.remove('open');
            other.querySelector('.timeline-node')?.setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
            item.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
        }
    });
});

// Open first timeline item by default
const firstItem = document.querySelector('.timeline-item');
if (firstItem) {
    firstItem.classList.add('open');
    firstItem.querySelector('.timeline-node')?.setAttribute('aria-expanded', 'true');
}

/* ── 3D tilt cards ─────────────────────────────────────────── */
if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.tilt').forEach((card) => {
        const color = card.dataset.color;
        if (color) card.style.setProperty('--card-color', color);

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const rx = (0.5 - y) * 10;
            const ry = (x - 0.5) * 12;
            card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.02,1.02,1.02)`;
            card.style.setProperty('--mx', `${x * 100}%`);
            card.style.setProperty('--my', `${y * 100}%`);
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
} else {
    document.querySelectorAll('[data-color]').forEach((card) => {
        card.style.setProperty('--card-color', card.dataset.color);
    });
}

/* ── Education flip (touch) ────────────────────────────────── */
const eduCard = document.getElementById('edu-card');
eduCard?.addEventListener('click', () => {
    if (window.matchMedia('(hover: none)').matches) {
        eduCard.classList.toggle('flipped');
    }
});

/* ── Copy email ────────────────────────────────────────────── */
const copyBtn = document.getElementById('copy-email');
copyBtn?.addEventListener('click', async () => {
    const label = copyBtn.querySelector('span');
    try {
        await navigator.clipboard.writeText(EMAIL);
        if (label) label.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            if (label) label.textContent = 'Copy email';
            copyBtn.classList.remove('copied');
        }, 1800);
    } catch {
        window.location.href = `mailto:${EMAIL}`;
    }
});

/* ── Cursor code particles ─────────────────────────────────── */
(function initParticles() {
    if (reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;

    class Particle {
        constructor(x, y) {
            this.x = x + (Math.random() - 0.5) * 16;
            this.y = y + (Math.random() - 0.5) * 16;
            this.vx = (Math.random() - 0.5) * 2.5;
            this.vy = (Math.random() - 0.5) * 2.5 - 0.5;
            this.size = Math.random() * 14 + 8;
            this.life = 1;
            this.decay = Math.random() * 0.025 + 0.012;
            this.el = document.createElement('div');
            this.el.className = 'code-particle';
            const symbols = ['λ', '<>', '{}', '=>', '::', '[]', 'fn', '∀'];
            this.el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            this.el.style.left = `${this.x}px`;
            this.el.style.top = `${this.y}px`;
            this.el.style.fontSize = `${this.size}px`;
            document.body.appendChild(this.el);
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.life -= this.decay;
            this.el.style.left = `${this.x}px`;
            this.el.style.top = `${this.y}px`;
            this.el.style.opacity = String(this.life);
            this.el.style.fontSize = `${this.size * this.life}px`;
            if (this.life <= 0) {
                this.el.remove();
                return true;
            }
            return false;
        }
    }

    const particles = [];
    let last = 0;
    window.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - last > 70 && particles.length < 30) {
            particles.push(new Particle(e.clientX, e.clientY));
            last = now;
        }
    }, { passive: true });

    (function loop() {
        for (let i = particles.length - 1; i >= 0; i--) {
            if (particles[i].update()) particles.splice(i, 1);
        }
        requestAnimationFrame(loop);
    })();
})();

/* ── Force-directed skill graph ────────────────────────────── */
function initSkillGraph() {
    if (typeof d3 === 'undefined') return;
    const container = document.querySelector('.force-graph');
    const svgEl = document.querySelector('.graph-svg');
    if (!container || !svgEl) return;

    const width = 900;
    const height = 520;
    const colors = {
        Backend: '#ff6b35',
        Frontend: '#4ecdc4',
        'AI/ML': '#45b7d1',
        Languages: '#f9ca24',
        Other: '#6c5ce7',
    };

    const nodes = [
        { id: 'Backend', group: 'Backend', type: 'core', description: '.NET Core, Node.js, GraphQL, Event Sourcing, CQRS, Pub/Sub, Terraform, Serverless, Clouds (AWS, Azure, GCP), Air-gapped systems' },
        { id: 'Frontend', group: 'Frontend', type: 'core', description: 'React, Redux, Webpack, Storybook, Testing: Mocha, Jasmine, Cypress, Authentication: OIDC, OAuth' },
        { id: 'AI/ML', group: 'AI/ML', type: 'core', description: 'Vision: YOLO, DETR-ResNet, ONNX Integration, LLMs, Ollama, Autonomous Agents, RAG' },
        { id: 'Languages', group: 'Languages', type: 'core', description: 'C#, F#, TypeScript, JavaScript, Rust, SQL, Python, Scala, Java' },
        { id: 'Other', group: 'Other', type: 'core', description: 'WebGPU, GStreamer, Docker, 3D: Volume Raycasting, React Three Fiber' },
        { id: '.NET Core', group: 'Backend', type: 'leaf', description: 'Primary backend framework for enterprise applications' },
        { id: 'Node.js', group: 'Backend', type: 'leaf', description: 'JavaScript runtime for server-side development' },
        { id: 'GraphQL', group: 'Backend', type: 'leaf', description: 'Query language for APIs' },
        { id: 'React', group: 'Frontend', type: 'leaf', description: 'Modern library for building user interfaces' },
        { id: 'Redux', group: 'Frontend', type: 'leaf', description: 'State management for React applications' },
        { id: 'TypeScript', group: 'Frontend', type: 'leaf', description: 'Typed superset of JavaScript' },
        { id: 'YOLO', group: 'AI/ML', type: 'leaf', description: 'Real-time object detection system' },
        { id: 'Python', group: 'AI/ML', type: 'leaf', description: 'Primary language for machine learning' },
        { id: 'Rust', group: 'Languages', type: 'leaf', description: 'Systems programming language' },
        { id: 'C#', group: 'Languages', type: 'leaf', description: 'Object-oriented programming language' },
        { id: 'Docker', group: 'Other', type: 'leaf', description: 'Containerization platform' },
        { id: 'WebGPU', group: 'Other', type: 'leaf', description: 'Modern graphics API for the web' },
        { id: 'JavaScript', group: 'Languages', type: 'leaf', description: 'Core web programming language' },
        { id: 'SQL', group: 'Languages', type: 'leaf', description: 'Database query language' },
        { id: 'AWS', group: 'Backend', type: 'leaf', description: 'Cloud computing platform' },
        { id: 'Terraform', group: 'Backend', type: 'leaf', description: 'Infrastructure as code' },
        { id: 'ONNX', group: 'AI/ML', type: 'leaf', description: 'Open Neural Network Exchange format' },
        { id: 'LLMs', group: 'AI/ML', type: 'leaf', description: 'Large Language Models & agents' },
        { id: 'Volume Raycasting', group: 'Other', type: 'leaf', description: '3D volume visualization technique' },
        { id: 'React Three Fiber', group: 'Other', type: 'leaf', description: 'React renderer for Three.js' },
    ];

    const links = [
        { source: 'Backend', target: '.NET Core' },
        { source: 'Backend', target: 'Node.js' },
        { source: 'Backend', target: 'GraphQL' },
        { source: 'Backend', target: 'AWS' },
        { source: 'Backend', target: 'Terraform' },
        { source: 'Backend', target: 'Docker' },
        { source: 'Frontend', target: 'React' },
        { source: 'Frontend', target: 'Redux' },
        { source: 'Frontend', target: 'TypeScript' },
        { source: 'Frontend', target: 'JavaScript' },
        { source: 'AI/ML', target: 'YOLO' },
        { source: 'AI/ML', target: 'Python' },
        { source: 'AI/ML', target: 'ONNX' },
        { source: 'AI/ML', target: 'LLMs' },
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
        { source: 'TypeScript', target: 'JavaScript' },
        { source: 'React', target: 'TypeScript' },
        { source: 'Node.js', target: 'TypeScript' },
        { source: 'C#', target: '.NET Core' },
        { source: 'Volume Raycasting', target: 'WebGPU' },
        { source: 'React Three Fiber', target: 'React' },
        { source: 'React Three Fiber', target: 'WebGPU' },
        { source: 'YOLO', target: 'Python' },
        { source: 'ONNX', target: 'Python' },
        { source: 'LLMs', target: 'Python' },
        { source: 'AWS', target: 'Terraform' },
        { source: 'GraphQL', target: 'Node.js' },
        { source: 'Redux', target: 'React' },
        { source: 'AI/ML', target: 'Backend' },
        { source: 'Frontend', target: 'Backend' },
        { source: 'Other', target: 'AI/ML' },
        { source: 'Rust', target: 'WebGPU' },
    ];

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id((d) => d.id).distance((d) => {
            if (d.source.type === 'core' || d.target.type === 'core') return 110;
            return 70;
        }).strength(0.55))
        .force('charge', d3.forceManyBody().strength((d) => (d.type === 'core' ? -900 : -420)))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
        .force('collision', d3.forceCollide().radius((d) => (d.type === 'core' ? 42 : 26)).strength(0.9))
        .force('x', d3.forceX(width / 2).strength(0.04))
        .force('y', d3.forceY(height / 2).strength(0.04))
        .velocityDecay(0.55)
        .alphaDecay(0.02);

    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'link');

    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', (d) => `node ${d.type}`)
        .call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.25).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }));

    node.append('circle')
        .attr('class', 'node-circle')
        .attr('r', (d) => (d.type === 'core' ? 22 : 12))
        .attr('fill', (d) => colors[d.group] || '#22d3ee');

    node.append('text')
        .attr('class', 'node-label')
        .attr('text-anchor', 'middle')
        .attr('dy', (d) => (d.type === 'core' ? '0.35em' : '1.7em'))
        .text((d) => d.id);

    const titleEl = document.getElementById('skills-panel-title');
    const descEl = document.getElementById('skills-panel-description');
    let selected = null;
    let activeFilter = 'all';

    function setPanel(d) {
        if (!titleEl || !descEl) return;
        if (d) {
            titleEl.textContent = d.id;
            descEl.textContent = d.description;
        } else {
            titleEl.textContent = 'Explore the graph';
            descEl.textContent = 'Hover or click a node to see how skills connect across the stack.';
        }
    }

    function highlight(d) {
        node.classed('highlighted', (n) => n === d);
        node.classed('dimmed', (n) => {
            if (!d) return false;
            if (activeFilter !== 'all' && n.group !== activeFilter) return true;
            if (n === d) return false;
            return !links.some((l) =>
                (l.source === d && l.target === n) || (l.target === d && l.source === n)
            );
        });
        link.classed('active', (l) => d && (l.source === d || l.target === d));
        link.classed('dimmed', (l) => {
            if (!d) return false;
            return l.source !== d && l.target !== d;
        });
        node.filter((n) => n === d).select('.node-label').style('opacity', 1);
    }

    function clearHighlight() {
        if (selected) {
            highlight(selected);
            return;
        }
        node.classed('highlighted', false);
        node.classed('dimmed', (n) => activeFilter !== 'all' && n.group !== activeFilter);
        link.classed('active', false);
        link.classed('dimmed', (l) => {
            if (activeFilter === 'all') return false;
            return l.source.group !== activeFilter && l.target.group !== activeFilter;
        });
        node.select('.node-label').style('opacity', null);
        setPanel(null);
    }

    function applyFilter(filter) {
        activeFilter = filter;
        node.classed('dimmed', (n) => filter !== 'all' && n.group !== filter);
        link.classed('dimmed', (l) => {
            if (filter === 'all') return false;
            return l.source.group !== filter && l.target.group !== filter;
        });
        if (selected && filter !== 'all' && selected.group !== filter) {
            selected = null;
            setPanel(null);
        } else if (selected) {
            highlight(selected);
        }
    }

    node.on('mouseenter', function (event, d) {
        if (selected) return;
        highlight(d);
        setPanel(d);
        d3.select(this).select('.node-label').style('opacity', 1);
    }).on('mouseleave', function () {
        if (selected) return;
        clearHighlight();
    }).on('click', function (event, d) {
        event.stopPropagation();
        if (selected === d) {
            selected = null;
            clearHighlight();
        } else {
            selected = d;
            highlight(d);
            setPanel(d);
        }
    });

    svg.on('click', () => {
        selected = null;
        clearHighlight();
    });

    simulation.on('tick', () => {
        nodes.forEach((d) => {
            d.x = clamp(d.x, 28, width - 28);
            d.y = clamp(d.y, 28, height - 28);
        });
        link
            .attr('x1', (d) => d.source.x)
            .attr('y1', (d) => d.source.y)
            .attr('x2', (d) => d.target.x)
            .attr('y2', (d) => d.target.y);
        node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    setTimeout(() => simulation.alphaTarget(0), 3500);

    document.querySelectorAll('.filter-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach((p) => {
                p.classList.remove('active');
                p.setAttribute('aria-selected', 'false');
            });
            pill.classList.add('active');
            pill.setAttribute('aria-selected', 'true');
            applyFilter(pill.dataset.filter);
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkillGraph);
} else {
    initSkillGraph();
}

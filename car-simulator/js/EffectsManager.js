// Visual Effects, Skid Marks, Particle Systems, Weather & Dynamic Lighting
class EffectsManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Environment lights
        this.hemiLight = null;
        this.sunLight = null;
        this.ambientLight = null;
        this.currentWeather = 'day'; // 'day', 'sunset', 'night', 'rain'
        this.weatherNames = ['Day', 'Sunset', 'Night', 'Rain'];

        // Skid marks
        this.skidMarks = [];
        this.maxSkidMarks = 400;
        this.skidMesh = null;
        this.skidGeometry = null;
        this.lastWheelPositions = [null, null, null, null];

        // Particle system (Smoke, Nitro Fire, Sparks, Rain)
        this.particles = [];
        this.maxParticles = 600;
        this.particleInstMesh = null;
        this.particleDummy = new THREE.Object3D();

        // Rain system
        this.rainParticles = null;
        this.isRaining = false;

        this.initEnvironment();
        this.initSkidMarks();
        this.initParticleSystem();
        this.initRainSystem();
    }

    initEnvironment() {
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0018);

        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
        this.hemiLight.position.set(0, 200, 0);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.sunLight.position.set(100, 250, 80);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 600;
        this.sunLight.shadow.camera.left = -120;
        this.sunLight.shadow.camera.right = 120;
        this.sunLight.shadow.camera.top = 120;
        this.sunLight.shadow.camera.bottom = -120;
        this.sunLight.shadow.bias = -0.0003;
        this.scene.add(this.sunLight);

        this.setWeather('day');
    }

    setWeather(type) {
        this.currentWeather = type;
        if (type === 'day') {
            this.scene.background = new THREE.Color(0x7ec0ee);
            this.scene.fog.color.setHex(0x7ec0ee);
            this.scene.fog.density = 0.0015;
            this.hemiLight.color.setHex(0xffffff);
            this.hemiLight.groundColor.setHex(0x444444);
            this.hemiLight.intensity = 0.7;
            this.sunLight.color.setHex(0xfffaed);
            this.sunLight.intensity = 1.0;
            this.sunLight.position.set(100, 250, 80);
            this.isRaining = false;
        } else if (type === 'sunset') {
            this.scene.background = new THREE.Color(0xff7744);
            this.scene.fog.color.setHex(0xdd6644);
            this.scene.fog.density = 0.002;
            this.hemiLight.color.setHex(0xffbb88);
            this.hemiLight.groundColor.setHex(0x552211);
            this.hemiLight.intensity = 0.6;
            this.sunLight.color.setHex(0xffaa55);
            this.sunLight.intensity = 1.2;
            this.sunLight.position.set(250, 60, 100);
            this.isRaining = false;
        } else if (type === 'night') {
            this.scene.background = new THREE.Color(0x060814);
            this.scene.fog.color.setHex(0x080b18);
            this.scene.fog.density = 0.0025;
            this.hemiLight.color.setHex(0x223366);
            this.hemiLight.groundColor.setHex(0x111122);
            this.hemiLight.intensity = 0.25;
            this.sunLight.color.setHex(0x4466aa);
            this.sunLight.intensity = 0.3;
            this.sunLight.position.set(50, 200, 50);
            this.isRaining = false;
        } else if (type === 'rain') {
            this.scene.background = new THREE.Color(0x3a4454);
            this.scene.fog.color.setHex(0x3a4454);
            this.scene.fog.density = 0.004;
            this.hemiLight.color.setHex(0x778899);
            this.hemiLight.groundColor.setHex(0x223344);
            this.hemiLight.intensity = 0.45;
            this.sunLight.color.setHex(0x99aabb);
            this.sunLight.intensity = 0.5;
            this.sunLight.position.set(80, 200, 60);
            this.isRaining = true;
        }
    }

    cycleWeather() {
        const list = ['day', 'sunset', 'night', 'rain'];
        const nextIdx = (list.indexOf(this.currentWeather) + 1) % list.length;
        this.setWeather(list[nextIdx]);
        return this.currentWeather.toUpperCase();
    }

    // --- Dynamic Skid Marks System ---
    initSkidMarks() {
        // Line segments/quads for tire skid marks
        const geom = new THREE.BufferGeometry();
        const maxVertices = this.maxSkidMarks * 6;
        const positions = new Float32Array(maxVertices * 3);
        const uvs = new Float32Array(maxVertices * 2);
        const colors = new Float32Array(maxVertices * 4);

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));

        const mat = new THREE.MeshBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.skidMesh = new THREE.Mesh(geom, mat);
        this.skidMesh.frustumCulled = false;
        this.scene.add(this.skidMesh);
    }

    addSkidMark(wheelIdx, currentPos, forwardDir, isSkidding) {
        const lastPos = this.lastWheelPositions[wheelIdx];
        if (!isSkidding || !lastPos) {
            this.lastWheelPositions[wheelIdx] = isSkidding ? currentPos.clone() : null;
            return;
        }

        const dist = currentPos.distanceTo(lastPos);
        if (dist > 0.4 && dist < 5.0) {
            // Create a small quad between lastPos and currentPos
            const right = new THREE.Vector3().crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.2);

            const p1 = lastPos.clone().add(right);
            const p2 = lastPos.clone().sub(right);
            const p3 = currentPos.clone().sub(right);
            const p4 = currentPos.clone().add(right);

            p1.y = Math.max(0.03, p1.y);
            p2.y = Math.max(0.03, p2.y);
            p3.y = Math.max(0.03, p3.y);
            p4.y = Math.max(0.03, p4.y);

            this.skidMarks.push({ p1, p2, p3, p4, age: 0 });
            if (this.skidMarks.length > this.maxSkidMarks) {
                this.skidMarks.shift();
            }

            this.lastWheelPositions[wheelIdx] = currentPos.clone();
            this.updateSkidMesh();
        }
    }

    updateSkidMesh() {
        if (!this.skidMesh) return;
        const positions = this.skidMesh.geometry.attributes.position.array;
        let vIdx = 0;

        for (let i = 0; i < this.skidMarks.length; i++) {
            const mark = this.skidMarks[i];
            const { p1, p2, p3, p4 } = mark;

            // Tri 1: p1, p2, p3
            positions[vIdx++] = p1.x; positions[vIdx++] = p1.y; positions[vIdx++] = p1.z;
            positions[vIdx++] = p2.x; positions[vIdx++] = p2.y; positions[vIdx++] = p2.z;
            positions[vIdx++] = p3.x; positions[vIdx++] = p3.y; positions[vIdx++] = p3.z;

            // Tri 2: p1, p3, p4
            positions[vIdx++] = p1.x; positions[vIdx++] = p1.y; positions[vIdx++] = p1.z;
            positions[vIdx++] = p3.x; positions[vIdx++] = p3.y; positions[vIdx++] = p3.z;
            positions[vIdx++] = p4.x; positions[vIdx++] = p4.y; positions[vIdx++] = p4.z;
        }

        // Zero out rest
        for (let i = vIdx; i < positions.length; i++) {
            positions[i] = 0;
        }

        this.skidMesh.geometry.attributes.position.needsUpdate = true;
    }

    // --- Particle System ---
    initParticleSystem() {
        const geom = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.particleInstMesh = new THREE.InstancedMesh(geom, mat, this.maxParticles);
        this.particleInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.particleInstMesh.frustumCulled = false;

        // Hide all initially
        for (let i = 0; i < this.maxParticles; i++) {
            this.particleDummy.position.set(0, -9999, 0);
            this.particleDummy.updateMatrix();
            this.particleInstMesh.setMatrixAt(i, this.particleDummy.matrix);
        }
        this.particleInstMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.particleInstMesh);
    }

    spawnParticle(type, pos, vel, size = 0.5, life = 0.8, colorHex = 0xffffff) {
        if (this.particles.length >= this.maxParticles) {
            this.particles.shift();
        }

        this.particles.push({
            type,
            pos: pos.clone(),
            vel: vel.clone(),
            size,
            initialSize: size,
            life,
            maxLife: life,
            colorHex
        });
    }

    spawnTireSmoke(pos, intensity = 1.0) {
        const count = Math.ceil(intensity * 2);
        for (let i = 0; i < count; i++) {
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                Math.random() * 0.6 + 0.3,
                (Math.random() - 0.5) * 0.8
            );
            const size = 0.4 + Math.random() * 0.4;
            const life = 0.6 + Math.random() * 0.5;
            this.spawnParticle('smoke', pos, vel, size, life, 0xdddddd);
        }
    }

    spawnNitroFlame(pos, backwardDir) {
        for (let i = 0; i < 3; i++) {
            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            const vel = backwardDir.clone().multiplyScalar(4.0).add(spread);
            const size = 0.35 + Math.random() * 0.2;
            const life = 0.2 + Math.random() * 0.15;
            const color = Math.random() > 0.3 ? 0x00e5ff : 0x7c4dff;
            this.spawnParticle('nitro', pos, vel, size, life, color);
        }
    }

    spawnBackfireSparks(pos, backwardDir) {
        for (let i = 0; i < 8; i++) {
            const spread = new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                Math.random() * 0.6,
                (Math.random() - 0.5) * 0.8
            );
            const vel = backwardDir.clone().multiplyScalar(3.0).add(spread);
            const life = 0.25 + Math.random() * 0.2;
            this.spawnParticle('spark', pos, vel, 0.15, life, 0xffaa00);
        }
    }

    spawnCrashSparks(pos, normal = new THREE.Vector3(0, 1, 0)) {
        for (let i = 0; i < 20; i++) {
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                Math.random() * 4 + 1,
                (Math.random() - 0.5) * 6
            ).add(normal.clone().multiplyScalar(2));
            const life = 0.4 + Math.random() * 0.3;
            this.spawnParticle('spark', pos, vel, 0.18, life, 0xffdd44);
        }
    }

    initRainSystem() {
        const rainCount = 1800;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(rainCount * 6);

        for (let i = 0; i < rainCount; i++) {
            const x = (Math.random() - 0.5) * 120;
            const y = Math.random() * 50;
            const z = (Math.random() - 0.5) * 120;
            const idx = i * 6;

            positions[idx] = x;
            positions[idx + 1] = y;
            positions[idx + 2] = z;

            positions[idx + 3] = x;
            positions[idx + 4] = y - 1.2;
            positions[idx + 5] = z;
        }

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.LineBasicMaterial({
            color: 0x99bbdd,
            transparent: true,
            opacity: 0.6
        });

        this.rainParticles = new THREE.LineSegments(geom, mat);
        this.scene.add(this.rainParticles);
    }

    update(dt, targetPos) {
        // Update particles
        const dummy = this.particleDummy;
        const camPos = this.camera.position;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                i--;
                continue;
            }

            p.pos.addScaledVector(p.vel, dt);
            if (p.type === 'smoke') {
                p.size += dt * 0.8;
                p.vel.y += dt * 0.3;
            } else if (p.type === 'spark') {
                p.vel.y -= dt * 9.8; // Gravity
                p.size = p.initialSize * (p.life / p.maxLife);
            }

            dummy.position.copy(p.pos);
            dummy.scale.set(p.size, p.size, p.size);
            dummy.lookAt(camPos);
            dummy.updateMatrix();

            this.particleInstMesh.setMatrixAt(i, dummy.matrix);
        }

        // Clean trailing slots
        for (let i = this.particles.length; i < this.maxParticles; i++) {
            dummy.position.set(0, -9999, 0);
            dummy.updateMatrix();
            this.particleInstMesh.setMatrixAt(i, dummy.matrix);
        }
        this.particleInstMesh.instanceMatrix.needsUpdate = true;

        // Update Rain
        if (this.rainParticles) {
            this.rainParticles.visible = this.isRaining;
            if (this.isRaining && targetPos) {
                this.rainParticles.position.x = targetPos.x;
                this.rainParticles.position.z = targetPos.z;

                const positions = this.rainParticles.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 6) {
                    positions[i + 1] -= dt * 60; // fall speed
                    positions[i + 4] = positions[i + 1] - 1.2;

                    if (positions[i + 1] < 0) {
                        positions[i + 1] = 40 + Math.random() * 10;
                        positions[i + 4] = positions[i + 1] - 1.2;
                    }
                }
                this.rainParticles.geometry.attributes.position.needsUpdate = true;
            }
        }

        // Sun follows target
        if (targetPos) {
            this.sunLight.target.position.copy(targetPos);
            this.sunLight.target.updateMatrixWorld();
        }
    }
}

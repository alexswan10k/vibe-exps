// Volume Raycaster using Three.js and WebGPU
class VolumeRaycaster {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.volumeMesh = null;
        this.volumeTexture = null;
        this.useWebGL2 = !!document.createElement('canvas').getContext('webgl2');
        this.init();
    }

    init() {
        this.setupScene();
        this.createVolumeData();
        this.createVolumeMesh();
        this.setupRenderer();
        this.addControls();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(2, 2, 2);
        this.camera.lookAt(0, 0, 0);
    }

    createVolumeData() {
        this.size = 32;
        const data = new Uint8Array(this.size * this.size * this.size * 4);

        // Generate 3D noise volume data
        for (let z = 0; z < this.size; z++) {
            for (let y = 0; y < this.size; y++) {
                for (let x = 0; x < this.size; x++) {
                    const index = (z * this.size * this.size + y * this.size + x) * 4;

                    // Create some interesting volume features
                    const nx = x / this.size - 0.5;
                    const ny = y / this.size - 0.5;
                    const nz = z / this.size - 0.5;

                    // Distance from center
                    const dist = Math.sqrt(nx * nx + ny * ny + nz * nz);

                    // Create spherical density with noise
                    let density = 0;
                    if (dist < 0.4) {
                        density = (0.4 - dist) / 0.4;
                        // Add some noise
                        density *= (Math.sin(nx * 20) * Math.cos(ny * 20) * Math.sin(nz * 20) * 0.5 + 0.5);
                    }

                    // Clamp and convert to color
                    density = Math.max(0, Math.min(1, density));

                    data[index] = density * 255;     // R
                    data[index + 1] = density * 200; // G
                    data[index + 2] = density * 150; // B
                    data[index + 3] = density * 255; // A
                }
            }
        }

        if (this.useWebGL2) {
            // Create 2D texture array (each layer is a 2D slice)
            this.volumeTexture = new THREE.DataTexture2DArray(data, this.size, this.size, this.size);
        } else {
            // Create 3D texture
            this.volumeTexture = new THREE.DataTexture3D(data, this.size, this.size, this.size);
        }
        this.volumeTexture.format = THREE.RGBAFormat;
        this.volumeTexture.type = THREE.UnsignedByteType;
        this.volumeTexture.minFilter = THREE.LinearFilter;
        this.volumeTexture.magFilter = THREE.LinearFilter;
        this.volumeTexture.needsUpdate = true;
    }

    createVolumeMesh() {
        try {
            // Vertex shader
            const vertexShader = `
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vPosition = position;
                    vNormal = normal;

                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;

            // Fragment shader for volume raycasting
            let fragmentShader;
            if (this.useWebGL2) {
                fragmentShader = `
                    precision mediump float;
                    precision mediump sampler2DArray;

                    uniform sampler2DArray volumeTexture;
                    uniform vec3 uCameraPosition;
                    uniform float stepSize;
                    uniform float opacityScale;
                    uniform float depth;

                    varying vec3 vPosition;
                    varying vec3 vNormal;
                    varying vec3 vWorldPosition;

                    void main() {
                        // Ray setup
                        vec3 rayOrigin = uCameraPosition;
                        vec3 rayDir = normalize(vWorldPosition - uCameraPosition);

                        // Volume bounds (assuming cube from -0.5 to 0.5)
                        vec3 boxMin = vec3(-0.5);
                        vec3 boxMax = vec3(0.5);

                        // Ray-box intersection
                        vec3 invRayDir = 1.0 / rayDir;
                        vec3 tMin = (boxMin - rayOrigin) * invRayDir;
                        vec3 tMax = (boxMax - rayOrigin) * invRayDir;
                        vec3 t1 = min(tMin, tMax);
                        vec3 t2 = max(tMin, tMax);
                        float tNear = max(max(t1.x, t1.y), t1.z);
                        float tFar = min(min(t2.x, t2.y), t2.z);

                        if (tNear >= tFar || tFar < 0.0) {
                            discard;
                        }

                        // Clamp to near plane
                        tNear = max(tNear, 0.0);

                        // Ray marching
                        vec3 color = vec3(0.0);
                        float alpha = 0.0;
                        vec3 pos = rayOrigin + rayDir * tNear;
                        float t = tNear;

                        for (int i = 0; i < 100; i++) {
                            if (t >= tFar) break;

                            // Sample volume texture using 2D array
                            vec3 texCoord = (pos + 0.5); // Transform to [0,1] range
                            float layer = texCoord.z * (depth - 1.0);
                            vec4 sampleColor = texture(volumeTexture, vec3(texCoord.x, texCoord.y, layer));

                            // Accumulate color with front-to-back blending
                            float sampleAlpha = sampleColor.a * opacityScale * stepSize;
                            color += sampleColor.rgb * sampleAlpha * (1.0 - alpha);
                            alpha += sampleAlpha * (1.0 - alpha);

                            if (alpha >= 0.95) break;

                            // Step forward
                            pos += rayDir * stepSize;
                            t += stepSize;
                        }

                        gl_FragColor = vec4(color, alpha);
                    }
                `;
            } else {
                fragmentShader = `
                    precision mediump float;
                    precision mediump sampler3D;

                    uniform sampler3D volumeTexture;
                    uniform vec3 cameraPosition;
                    uniform float stepSize;
                    uniform float opacityScale;

                    varying vec3 vPosition;
                    varying vec3 vNormal;
                    varying vec3 vWorldPosition;

                    void main() {
                        // Ray setup
                        vec3 rayOrigin = cameraPosition;
                        vec3 rayDir = normalize(vWorldPosition - cameraPosition);

                        // Volume bounds (assuming cube from -0.5 to 0.5)
                        vec3 boxMin = vec3(-0.5);
                        vec3 boxMax = vec3(0.5);

                        // Ray-box intersection
                        vec3 invRayDir = 1.0 / rayDir;
                        vec3 tMin = (boxMin - rayOrigin) * invRayDir;
                        vec3 tMax = (boxMax - rayOrigin) * invRayDir;
                        vec3 t1 = min(tMin, tMax);
                        vec3 t2 = max(tMin, tMax);
                        float tNear = max(max(t1.x, t1.y), t1.z);
                        float tFar = min(min(t2.x, t2.y), t2.z);

                        if (tNear >= tFar || tFar < 0.0) {
                            discard;
                        }

                        // Clamp to near plane
                        tNear = max(tNear, 0.0);

                        // Ray marching
                        vec3 color = vec3(0.0);
                        float alpha = 0.0;
                        vec3 pos = rayOrigin + rayDir * tNear;
                        float t = tNear;

                        for (int i = 0; i < 100; i++) {
                            if (t >= tFar) break;

                            // Sample volume texture
                            vec3 texCoord = (pos + 0.5); // Transform to [0,1] range
                            vec4 sampleColor = texture(volumeTexture, texCoord);

                            // Accumulate color with front-to-back blending
                            float sampleAlpha = sampleColor.a * opacityScale * stepSize;
                            color += sampleColor.rgb * sampleAlpha * (1.0 - alpha);
                            alpha += sampleAlpha * (1.0 - alpha);

                            if (alpha >= 0.95) break;

                            // Step forward
                            pos += rayDir * stepSize;
                            t += stepSize;
                        }

                        gl_FragColor = vec4(color, alpha);
                    }
                `;
            }

            // Create shader material
            const uniforms = {
                volumeTexture: { value: this.volumeTexture },
                stepSize: { value: 0.01 },
                opacityScale: { value: 10.0 }
            };

            if (this.useWebGL2) {
                uniforms.uCameraPosition = { value: this.camera.position };
                uniforms.depth = { value: this.size };
            } else {
                uniforms.cameraPosition = { value: this.camera.position };
            }

            const material = new THREE.ShaderMaterial({
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                uniforms: uniforms,
                transparent: true,
                side: THREE.BackSide
            });

            // Create cube geometry
            const geometry = new THREE.BoxGeometry(1, 1, 1);

            this.volumeMesh = new THREE.Mesh(geometry, material);
            this.scene.add(this.volumeMesh);

            console.log('Volume mesh created successfully');

        } catch (error) {
            console.error('Error creating volume mesh:', error);

            // Fallback: create a simple colored cube
            console.log('Creating fallback cube...');
            const fallbackMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.5,
                side: THREE.BackSide
            });
            const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
            this.volumeMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            this.scene.add(this.volumeMesh);
            console.log('Fallback cube created');
        }
    }

    setupRenderer() {
        const canvas = document.createElement('canvas');
        let gl;

        if (this.useWebGL2) {
            gl = canvas.getContext('webgl2');
            if (!gl) {
                console.error('WebGL2 not supported despite detection');
                document.getElementById('info').innerHTML = 'WebGL2 not supported by your browser';
                return;
            }
            console.log('Using WebGL2 with 2D texture array support');
        } else {
            gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) {
                console.error('WebGL not supported');
                document.getElementById('info').innerHTML = 'WebGL not supported by your browser';
                return;
            }
            // Check for 3D texture support
            if (!gl.getExtension('OES_texture_3D')) {
                console.error('OES_texture_3D extension not supported');
                document.getElementById('info').innerHTML = '3D textures not supported by your browser';
                return;
            }
            console.log('Using WebGL1 with 3D texture support');
        }

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: canvas,
            context: gl
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        const container = document.getElementById('container');
        container.appendChild(this.renderer.domElement);

        console.log('WebGL renderer initialized successfully');

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    addControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        // Update camera position uniform
        if (this.volumeMesh) {
            if (this.useWebGL2 && this.volumeMesh.material.uniforms.uCameraPosition) {
                this.volumeMesh.material.uniforms.uCameraPosition.value.copy(this.camera.position);
            } else if (!this.useWebGL2 && this.volumeMesh.material.uniforms.cameraPosition) {
                this.volumeMesh.material.uniforms.cameraPosition.value.copy(this.camera.position);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    new VolumeRaycaster();
});

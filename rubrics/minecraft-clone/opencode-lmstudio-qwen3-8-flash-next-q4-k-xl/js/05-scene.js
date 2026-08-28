/* renderer, scene, sky (sun/moon/stars/clouds), day-night cycle, crack overlay, outline, particles */
'use strict';

const Scene = (() => {
  let renderer, scene, camera, hemi, dirLight;
  const group = new THREE.Group();          // chunk meshes live here
  let skyGroup, sunMesh, moonMesh, stars, clouds, cloudTex;
  let crackMesh, outlineMesh, crackTex = [];
  const particles = [];
  let tod = .27, dayF = 1;

  const DAY_SKY = new THREE.Color('#8ED0FF'), NIGHT_SKY = new THREE.Color('#060a1f'), SUNSET = new THREE.Color('#e08a3c');
  const skyCol = new THREE.Color();

  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.background = DAY_SKY.clone();
    scene.fog = new THREE.Fog(DAY_SKY.getHex(), 40, 100);

    camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .08, 1200);
    camera.rotation.order = 'YXZ';
    scene.add(group);

    hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6b6f5e, .95);
    dirLight = new THREE.DirectionalLight(0xfff4d6, .7);
    scene.add(hemi, dirLight, camera, dirLight.target);

    buildSky();
    buildHelpers();
    addEventListener('resize', onResize);
  }

  function tex(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function buildSky() {
    skyGroup = new THREE.Group();
    scene.add(skyGroup);

    sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(46, 46),
      new THREE.MeshBasicMaterial({ map: tex(Tex.discCanvas('#fff9c8', '#ffe98a')), fog: false, transparent: true, depthWrite: false }));
    moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 32),
      new THREE.MeshBasicMaterial({ map: tex(Tex.discCanvas('#e8ecf4', '#aab4c8')), fog: false, transparent: true, depthWrite: false }));
    skyGroup.add(sunMesh, moonMesh);

    const N = 700, pos = new Float32Array(N * 3), r = mulberry32(4242);
    for (let i = 0; i < N; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(r() * 1.9 - .9), R = 500;
      pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = R * Math.cos(ph);
      pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    skyGroup.add(stars);

    cloudTex = tex(Tex.cloudCanvas());
    cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
    cloudTex.repeat.set(3, 3);
    clouds = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }));
    clouds.rotation.x = Math.PI / 2;
    scene.add(clouds);
  }

  function buildHelpers() {
    crackTex = Tex.crackCanvases().map(tex);
    crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: .95 }));
    crackMesh.visible = false;
    scene.add(crackMesh);

    outlineMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: .6 }));
    outlineMesh.visible = false;
    scene.add(outlineMesh);

    const pg = new THREE.BoxGeometry(.13, .13, .13);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ transparent: true }));
      m.visible = false; m.userData.life = 0;
      scene.add(m); particles.push(m);
    }
  }

  /* ---------- public helpers for interaction ---------- */
  function setOutline(x, y, z) { outlineMesh.position.set(x + .5, y + .5, z + .5); outlineMesh.visible = true; }
  function hideOutline() { outlineMesh.visible = false; }
  function setCrack(x, y, z, stage) {
    crackMesh.material.map = crackTex[clamp(stage, 0, 9)];
    crackMesh.position.set(x + .5, y + .5, z + .5);
    crackMesh.visible = true;
  }
  function hideCrack() { crackMesh.visible = false; }

  function burst(x, y, z, rgb) {
    let n = 0;
    for (const p of particles) {
      if (p.userData.life > 0) continue;
      const r = Math.random;
      p.position.set(x + .2 + r() * .6, y + .2 + r() * .6, z + .2 + r() * .6);
      p.userData.vel = [(r() - .5) * 4, 2 + r() * 3.5, (r() - .5) * 4];
      p.userData.life = .5 + r() * .2;
      p.material.color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      p.visible = true;
      if (++n >= 9) break;
    }
  }

  /* ---------- per-frame ---------- */
  function update(dt, camPos) {
    tod = (tod + dt / CFG.DAY_LEN) % 1;
    const ang = (tod - .25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), .28).normalize();
    dayF = clamp((sunDir.y + .16) / .4, 0, 1);

    // sky + fog color (with sunset tint near the horizon crossing)
    skyCol.copy(NIGHT_SKY).lerp(DAY_SKY, dayF);
    const sunset = (1 - Math.abs(dayF * 2 - 1)) * .38;
    if (sunset > 0) skyCol.lerp(SUNSET, sunset);
    scene.background.copy(skyCol);
    scene.fog.color.copy(skyCol);

    // lights follow the sun; keep a moonlit floor so night stays playable
    hemi.intensity = .3 + dayF * .75;
    dirLight.intensity = .12 + dayF * .68;
    dirLight.target.position.copy(camPos);
    dirLight.position.copy(camPos).addScaledVector(sunDir, 100);

    // sky objects ride with the camera
    skyGroup.position.copy(camPos);
    sunMesh.position.copy(sunDir).multiplyScalar(430); sunMesh.lookAt(camPos);
    moonMesh.position.copy(sunDir).multiplyScalar(-430); moonMesh.lookAt(camPos);
    stars.material.opacity = (1 - dayF) * .9;

    clouds.position.set(camPos.x, 88, camPos.z);
    cloudTex.offset.x += dt * .0025;

    // particles
    for (const p of particles) {
      if (p.userData.life <= 0) continue;
      p.userData.life -= dt;
      const v = p.userData.vel;
      v[1] -= 18 * dt;
      p.position.x += v[0] * dt; p.position.y += v[1] * dt; p.position.z += v[2] * dt;
      if (p.userData.life <= 0) p.visible = false;
    }
  }

  function setRenderDist(chunksN) {
    const far = chunksN * CFG.CHUNK + 30;
    scene.fog.near = far * .62;
    scene.fog.far = far;
  }

  // underwater look
  let fogBackup = null;
  function setUnderwater(on) {
    if (on && !fogBackup) {
      fogBackup = { near: scene.fog.near, far: scene.fog.far, col: scene.fog.color.clone() };
      scene.fog.near = .1; scene.fog.far = 26; scene.fog.color.set('#1c4a8a');
    } else if (!on && fogBackup) {
      scene.fog.near = fogBackup.near; scene.fog.far = fogBackup.far;
      scene.fog.color.copy(fogBackup.col); fogBackup = null;
    }
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  return {
    init, update, setRenderDist, setUnderwater, setOutline, hideOutline, setCrack, hideCrack, burst, getScene: () => scene,
    get camera() { return camera; }, get renderer() { return renderer; }, get group() { return group; },
    get tod() { return tod; }, set tod(v) { tod = v; }, get dayF() { return dayF; }
  };
})();

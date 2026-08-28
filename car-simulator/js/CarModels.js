// Procedural 3D Car Visual Models (Supercar, Muscle, Hypercar, Titan 4x4)
class CarModels {
    static get CAR_TYPES() {
        return [
            { id: 0, name: 'Apex Supercar', class: 'Supercar', desc: 'Balanced speed, razor sharp handling' },
            { id: 1, name: 'V8 Thunder', class: 'Muscle', desc: 'Raw torque, extreme drift slide' },
            { id: 2, name: 'Neon Phantom', class: 'Hypercar', desc: 'Hyper acceleration & ultra downforce' },
            { id: 3, name: 'Titan 4x4', class: 'Offroad', desc: 'Heavy chassis, stunt ramp monster' }
        ];
    }

    static createCarMesh(typeIndex = 0) {
        const rootGroup = new THREE.Group();

        // Common Materials
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x050508,
            roughness: 0.05,
            metalness: 0.95,
            transparent: true,
            opacity: 0.75
        });
        const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 });
        const blackPlasticMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
        const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.2 });
        const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });

        // Headlight glow material
        const hlEmissiveMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 2.5
        });

        // Taillight glow material (brightens on brake)
        const tlEmissiveMat = new THREE.MeshStandardMaterial({
            color: 0xff0022,
            emissive: 0xff0022,
            emissiveIntensity: 1.0
        });

        // Spotlights for realistic night driving
        const leftHeadlight = new THREE.SpotLight(0xfffaed, 2.5, 120, Math.PI / 6, 0.4, 1.2);
        const rightHeadlight = new THREE.SpotLight(0xfffaed, 2.5, 120, Math.PI / 6, 0.4, 1.2);
        leftHeadlight.castShadow = false;
        rightHeadlight.castShadow = false;

        const leftTarget = new THREE.Object3D();
        const rightTarget = new THREE.Object3D();
        rootGroup.add(leftTarget);
        rootGroup.add(rightTarget);
        leftHeadlight.target = leftTarget;
        rightHeadlight.target = rightTarget;

        let steeringWheelMesh = null;
        const exhaustPoints = [];

        if (typeIndex === 0) {
            // --- 0: APEX SUPERCAR ---
            const bodyColor = 0xe51837; // Crimson Red
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.65, roughness: 0.22 });

            // Lower Body / Chasis
            const lowerGeom = new THREE.BoxGeometry(4.4, 0.5, 2.0);
            const lower = new THREE.Mesh(lowerGeom, bodyMat);
            lower.position.set(0, 0.3, 0);
            lower.castShadow = true;
            rootGroup.add(lower);

            // Sleek aerodynamic nose
            const noseGeom = new THREE.BoxGeometry(1.2, 0.35, 1.9);
            const nose = new THREE.Mesh(noseGeom, bodyMat);
            nose.position.set(2.0, 0.22, 0);
            nose.castShadow = true;
            rootGroup.add(nose);

            // Front Splitter (Carbon)
            const splitterGeom = new THREE.BoxGeometry(1.0, 0.08, 2.1);
            const splitter = new THREE.Mesh(splitterGeom, carbonMat);
            splitter.position.set(2.25, 0.08, 0);
            rootGroup.add(splitter);

            // Cabin (Sloped Glass)
            const cabinGeom = new THREE.BoxGeometry(2.3, 0.55, 1.6);
            const cabin = new THREE.Mesh(cabinGeom, glassMat);
            cabin.position.set(-0.2, 0.8, 0);
            cabin.castShadow = true;
            rootGroup.add(cabin);

            // Roof
            const roofGeom = new THREE.BoxGeometry(1.8, 0.08, 1.55);
            const roof = new THREE.Mesh(roofGeom, bodyMat);
            roof.position.set(-0.2, 1.1, 0);
            rootGroup.add(roof);

            // Carbon GT Wing
            const wingGroup = new THREE.Group();
            wingGroup.position.set(-2.1, 0.75, 0);
            const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 2.2), carbonMat);
            wingBlade.position.y = 0.35;
            wingGroup.add(wingBlade);

            const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.05), carbonMat);
            strutL.position.set(0, 0.15, 0.65);
            const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.05), carbonMat);
            strutR.position.set(0, 0.15, -0.65);
            wingGroup.add(strutL);
            wingGroup.add(strutR);
            rootGroup.add(wingGroup);

            // Headlights
            const hlGeom = new THREE.BoxGeometry(0.2, 0.12, 0.45);
            const hlL = new THREE.Mesh(hlGeom, hlEmissiveMat);
            hlL.position.set(2.4, 0.35, 0.7);
            const hlR = new THREE.Mesh(hlGeom, hlEmissiveMat);
            hlR.position.set(2.4, 0.35, -0.7);
            rootGroup.add(hlL);
            rootGroup.add(hlR);

            // Taillight bar
            const tlGeom = new THREE.BoxGeometry(0.1, 0.12, 1.8);
            const tl = new THREE.Mesh(tlGeom, tlEmissiveMat);
            tl.position.set(-2.22, 0.45, 0);
            rootGroup.add(tl);

            // Center Dual Exhausts
            const exGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12);
            exGeom.rotateZ(Math.PI / 2);
            const ex1 = new THREE.Mesh(exGeom, chromeMat);
            ex1.position.set(-2.25, 0.25, 0.2);
            const ex2 = new THREE.Mesh(exGeom, chromeMat);
            ex2.position.set(-2.25, 0.25, -0.2);
            rootGroup.add(ex1);
            rootGroup.add(ex2);

            exhaustPoints.push(new THREE.Vector3(-2.3, 0.25, 0.2));
            exhaustPoints.push(new THREE.Vector3(-2.3, 0.25, -0.2));

            // Headlight spots
            leftHeadlight.position.set(2.4, 0.4, 0.7);
            leftTarget.position.set(15, 0, 0.7);
            rightHeadlight.position.set(2.4, 0.4, -0.7);
            rightTarget.position.set(15, 0, -0.7);

            // Interior Cockpit & Steering Wheel
            const interior = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.3), interiorMat);
            interior.position.set(-0.2, 0.5, 0);
            rootGroup.add(interior);

            const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 16), blackPlasticMat);
            wheelRing.position.set(0.4, 0.75, -0.35);
            wheelRing.rotation.y = Math.PI / 2;
            wheelRing.rotation.z = -Math.PI / 10;
            rootGroup.add(wheelRing);
            steeringWheelMesh = wheelRing;

        } else if (typeIndex === 1) {
            // --- 1: V8 THUNDER MUSCLE CAR ---
            const bodyColor = 0xffa000; // Muscle Amber Gold
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.4, roughness: 0.3 });

            // Muscular Boxy Main Body
            const mainGeom = new THREE.BoxGeometry(4.6, 0.7, 2.1);
            const main = new THREE.Mesh(mainGeom, bodyMat);
            main.position.set(0, 0.4, 0);
            main.castShadow = true;
            rootGroup.add(main);

            // Hood Supercharger Blower
            const blowerGeom = new THREE.BoxGeometry(0.9, 0.35, 0.6);
            const blower = new THREE.Mesh(blowerGeom, chromeMat);
            blower.position.set(1.2, 0.88, 0);
            rootGroup.add(blower);

            // Supercharger intake scoops
            const scoopsGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8);
            scoopsGeom.rotateZ(Math.PI / 2);
            for (let s = -1; s <= 1; s++) {
                const scoop = new THREE.Mesh(scoopsGeom, new THREE.MeshBasicMaterial({ color: 0xff2200 }));
                scoop.position.set(1.65, 0.95, s * 0.18);
                rootGroup.add(scoop);
            }

            // Fastback Cabin
            const cabinGeom = new THREE.BoxGeometry(2.2, 0.6, 1.7);
            const cabin = new THREE.Mesh(cabinGeom, glassMat);
            cabin.position.set(-0.4, 0.95, 0);
            cabin.castShadow = true;
            rootGroup.add(cabin);

            // Roof
            const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.7), bodyMat);
            roof.position.set(-0.4, 1.28, 0);
            rootGroup.add(roof);

            // Racing Stripes (Gloss Black)
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.02, 0.45), carbonMat);
            stripe.position.set(0, 0.76, 0);
            rootGroup.add(stripe);

            // Round Dual Headlights
            const hlGeom = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16);
            hlGeom.rotateZ(Math.PI / 2);
            const hlL1 = new THREE.Mesh(hlGeom, hlEmissiveMat);
            hlL1.position.set(2.32, 0.45, 0.75);
            const hlL2 = new THREE.Mesh(hlGeom, hlEmissiveMat);
            hlL2.position.set(2.32, 0.45, 0.45);
            const hlR1 = new THREE.Mesh(hlGeom, hlEmissiveMat);
            hlR1.position.set(2.32, 0.45, -0.75);
            const hlR2 = new THREE.Mesh(hlGeom, hlEmissiveMat);
            hlR2.position.set(2.32, 0.45, -0.45);
            rootGroup.add(hlL1);
            rootGroup.add(hlL2);
            rootGroup.add(hlR1);
            rootGroup.add(hlR2);

            // Taillights
            const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.6), tlEmissiveMat);
            tlL.position.set(-2.32, 0.5, 0.65);
            const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.6), tlEmissiveMat);
            tlR.position.set(-2.32, 0.5, -0.65);
            rootGroup.add(tlL);
            rootGroup.add(tlR);

            // Quad Side/Rear Exhausts
            const exGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.3, 12);
            exGeom.rotateZ(Math.PI / 2);
            const ex1 = new THREE.Mesh(exGeom, chromeMat);
            ex1.position.set(-2.35, 0.22, 0.7);
            const ex2 = new THREE.Mesh(exGeom, chromeMat);
            ex2.position.set(-2.35, 0.22, -0.7);
            rootGroup.add(ex1);
            rootGroup.add(ex2);

            exhaustPoints.push(new THREE.Vector3(-2.4, 0.22, 0.7));
            exhaustPoints.push(new THREE.Vector3(-2.4, 0.22, -0.7));

            leftHeadlight.position.set(2.4, 0.45, 0.6);
            leftTarget.position.set(15, 0, 0.6);
            rightHeadlight.position.set(2.4, 0.45, -0.6);
            rightTarget.position.set(15, 0, -0.6);

            // Steering Wheel
            const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16), chromeMat);
            wheelRing.position.set(0.35, 0.85, -0.38);
            wheelRing.rotation.y = Math.PI / 2;
            wheelRing.rotation.z = -Math.PI / 10;
            rootGroup.add(wheelRing);
            steeringWheelMesh = wheelRing;

        } else if (typeIndex === 2) {
            // --- 2: NEON PHANTOM CYBER HYPERCAR ---
            const bodyColor = 0x12141a; // Stealth Dark Titanium
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.9, roughness: 0.15 });
            const neonCyanMat = new THREE.MeshStandardMaterial({
                color: 0x00f3ff,
                emissive: 0x00f3ff,
                emissiveIntensity: 3.0
            });

            // Angular Chiseled Body
            const main = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.45, 2.1), bodyMat);
            main.position.set(0, 0.28, 0);
            main.castShadow = true;
            rootGroup.add(main);

            // Cyan Neon Side Accents
            const neonL = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.05, 0.06), neonCyanMat);
            neonL.position.set(0, 0.15, 1.06);
            const neonR = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.05, 0.06), neonCyanMat);
            neonR.position.set(0, 0.15, -1.06);
            rootGroup.add(neonL);
            rootGroup.add(neonR);

            // Jet Canopy Glass
            const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.2, 4), glassMat);
            canopy.rotation.z = Math.PI / 2;
            canopy.rotation.y = Math.PI / 4;
            canopy.scale.set(0.6, 1.0, 1.2);
            canopy.position.set(-0.2, 0.7, 0);
            rootGroup.add(canopy);

            // Active Aero Double Wings
            const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.8), carbonMat);
            wingL.position.set(-1.8, 0.85, 0.7);
            wingL.rotation.z = -0.15;
            const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.8), carbonMat);
            wingR.position.set(-1.8, 0.85, -0.7);
            wingR.rotation.z = -0.15;
            rootGroup.add(wingL);
            rootGroup.add(wingR);

            // Laser Blade Headlights
            const hlGeom = new THREE.BoxGeometry(0.3, 0.06, 0.7);
            const hlL = new THREE.Mesh(hlGeom, neonCyanMat);
            hlL.position.set(2.3, 0.3, 0.65);
            const hlR = new THREE.Mesh(hlGeom, neonCyanMat);
            hlR.position.set(2.3, 0.3, -0.65);
            rootGroup.add(hlL);
            rootGroup.add(hlR);

            // Taillight Pulse Strip
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 2.0), tlEmissiveMat);
            tl.position.set(-2.28, 0.4, 0);
            rootGroup.add(tl);

            // Cyber Thruster Nozzles
            const th1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.4, 16), neonCyanMat);
            th1.rotateZ(Math.PI / 2);
            th1.position.set(-2.28, 0.3, 0.35);
            const th2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.4, 16), neonCyanMat);
            th2.rotateZ(Math.PI / 2);
            th2.position.set(-2.28, 0.3, -0.35);
            rootGroup.add(th1);
            rootGroup.add(th2);

            exhaustPoints.push(new THREE.Vector3(-2.35, 0.3, 0.35));
            exhaustPoints.push(new THREE.Vector3(-2.35, 0.3, -0.35));

            leftHeadlight.color.setHex(0x99f0ff);
            rightHeadlight.color.setHex(0x99f0ff);
            leftHeadlight.position.set(2.4, 0.35, 0.65);
            leftTarget.position.set(15, 0, 0.65);
            rightHeadlight.position.set(2.4, 0.35, -0.65);
            rightTarget.position.set(15, 0, -0.65);

            // Cyber Yoke Steering Wheel
            const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.28), neonCyanMat);
            yoke.position.set(0.35, 0.72, -0.32);
            rootGroup.add(yoke);
            steeringWheelMesh = yoke;

        } else {
            // --- 3: TITAN 4x4 OFFROAD MONSTER ---
            const bodyColor = 0x2e7d32; // Tactical Forest Green
            const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.2 });

            // High Clearance Cab
            const main = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 2.2), bodyMat);
            main.position.set(0, 0.7, 0);
            main.castShadow = true;
            rootGroup.add(main);

            // Pickup Bed / Roll Cage
            const bedWallL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.1), bodyMat);
            bedWallL.position.set(-1.3, 1.2, 1.05);
            const bedWallR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.1), bodyMat);
            bedWallR.position.set(-1.3, 1.2, -1.05);
            rootGroup.add(bedWallL);
            rootGroup.add(bedWallR);

            // Heavy Bull Bar (Front)
            const bullBar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 2.1), blackPlasticMat);
            bullBar.position.set(2.25, 0.65, 0);
            rootGroup.add(bullBar);

            // Roof 5-Pod Light Rack
            const rack = new THREE.Group();
            rack.position.set(0.2, 1.7, 0);
            for (let i = -2; i <= 2; i++) {
                const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 12), hlEmissiveMat);
                pod.rotateZ(Math.PI / 2);
                pod.position.set(0, 0, i * 0.35);
                rack.add(pod);
            }
            rootGroup.add(rack);

            // Cabin Glass
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.9), glassMat);
            cabin.position.set(0.2, 1.3, 0);
            cabin.castShadow = true;
            rootGroup.add(cabin);

            // Spare Tire in bed
            const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16), blackPlasticMat);
            spare.rotation.x = Math.PI / 3;
            spare.position.set(-1.2, 1.2, 0);
            rootGroup.add(spare);

            // Headlights
            const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.35), hlEmissiveMat);
            hlL.position.set(2.15, 0.75, 0.75);
            const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.35), hlEmissiveMat);
            hlR.position.set(2.15, 0.75, -0.75);
            rootGroup.add(hlL);
            rootGroup.add(hlR);

            // Taillights
            const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.2), tlEmissiveMat);
            tlL.position.set(-2.15, 0.8, 0.9);
            const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.2), tlEmissiveMat);
            tlR.position.set(-2.15, 0.8, -0.9);
            rootGroup.add(tlL);
            rootGroup.add(tlR);

            // Snorkel Exhaust High Mount
            const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 12), blackPlasticMat);
            ex.position.set(0.6, 1.4, 1.15);
            rootGroup.add(ex);

            exhaustPoints.push(new THREE.Vector3(0.6, 2.0, 1.15));

            leftHeadlight.position.set(2.3, 0.8, 0.75);
            leftTarget.position.set(15, 0, 0.75);
            rightHeadlight.position.set(2.3, 0.8, -0.75);
            rightTarget.position.set(15, 0, -0.75);

            // Steering Wheel
            const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 16), blackPlasticMat);
            wheelRing.position.set(0.55, 1.15, -0.4);
            wheelRing.rotation.y = Math.PI / 2;
            wheelRing.rotation.z = -Math.PI / 8;
            rootGroup.add(wheelRing);
            steeringWheelMesh = wheelRing;
        }

        rootGroup.add(leftHeadlight);
        rootGroup.add(rightHeadlight);

        return {
            mesh: rootGroup,
            steeringWheel: steeringWheelMesh,
            taillightMat: tlEmissiveMat,
            headlights: [leftHeadlight, rightHeadlight],
            exhaustPoints: exhaustPoints
        };
    }

    static createWheelMeshes(typeIndex = 0) {
        const wheels = [];
        const isOffroad = typeIndex === 3;
        const radius = isOffroad ? 0.55 : 0.42;
        const width = isOffroad ? 0.45 : 0.32;

        const tireMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.85,
            metalness: 0.1
        });
        const rimMat = new THREE.MeshStandardMaterial({
            color: typeIndex === 2 ? 0x00f3ff : 0xdddddd,
            metalness: 0.85,
            roughness: 0.2
        });
        const brakeDiscMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
        const caliperMat = new THREE.MeshStandardMaterial({ color: 0xdd1111, roughness: 0.3 });

        for (let i = 0; i < 4; i++) {
            const wheelGroup = new THREE.Group();

            // Tire
            const tireGeom = new THREE.CylinderGeometry(radius, radius, width, 24);
            tireGeom.rotateZ(Math.PI / 2);
            const tire = new THREE.Mesh(tireGeom, tireMat);
            tire.castShadow = true;
            wheelGroup.add(tire);

            // Rim center
            const rimGeom = new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width + 0.02, 16);
            rimGeom.rotateZ(Math.PI / 2);
            const rim = new THREE.Mesh(rimGeom, rimMat);
            wheelGroup.add(rim);

            // Spokes
            for (let s = 0; s < 5; s++) {
                const angle = (s / 5) * Math.PI * 2;
                const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, radius * 0.6, width + 0.03), rimMat);
                spoke.position.set(0, Math.cos(angle) * radius * 0.3, Math.sin(angle) * radius * 0.3);
                wheelGroup.add(spoke);
            }

            // Brake Disc & Caliper inside
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.05, 16), brakeDiscMat);
            disc.rotateZ(Math.PI / 2);
            disc.position.x = i % 2 === 0 ? 0.05 : -0.05;
            wheelGroup.add(disc);

            const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.1, radius * 0.25, 0.12), caliperMat);
            caliper.position.set(disc.position.x, radius * 0.35, 0);
            wheelGroup.add(caliper);

            wheels.push(wheelGroup);
        }

        return wheels;
    }
}

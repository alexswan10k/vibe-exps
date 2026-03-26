/**
 * Generates procedural assets for the game:
 * - A track texture (tilemap)
 * - A simple car sprite
 * - A background/sky texture
 */

const trackSize = 1024; // Power of 2 for easy wrapping/scaling

function generateTrackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = trackSize;
    canvas.height = trackSize;
    const ctx = canvas.getContext('2d');

    // Base dirt/sand color
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, trackSize, trackSize);

    // Add noise to dirt
    const imgData = ctx.getImageData(0, 0, trackSize, trackSize);
    for (let i = 0; i < imgData.data.length; i += 4) {
        let noise = (Math.random() - 0.5) * 40;
        imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + noise));
        imgData.data[i+1] = Math.min(255, Math.max(0, imgData.data[i+1] + noise));
        imgData.data[i+2] = Math.min(255, Math.max(0, imgData.data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Draw track path
    ctx.lineWidth = 120;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Grey asphalt
    ctx.strokeStyle = '#555';

    // A simple circuit
    ctx.beginPath();
    ctx.moveTo(200, 800);
    ctx.lineTo(200, 200);
    ctx.lineTo(800, 200);
    ctx.lineTo(800, 600);
    ctx.lineTo(500, 600);
    ctx.lineTo(500, 800);
    ctx.closePath();
    ctx.stroke();

    // Track borders
    ctx.lineWidth = 140;
    ctx.strokeStyle = '#fff';
    // Use dash for a "curb" look
    ctx.setLineDash([20, 20]);
    ctx.stroke();

    // Overwrite inner part with asphalt again to leave curbs
    ctx.lineWidth = 120;
    ctx.strokeStyle = '#555';
    ctx.setLineDash([]);
    ctx.stroke();

    // Start/finish line
    ctx.fillStyle = '#fff';
    ctx.fillRect(140, 750, 120, 20);
    ctx.fillStyle = '#000';
    for(let i = 0; i < 6; i++) {
        ctx.fillRect(140 + i*20, 750, 10, 10);
        ctx.fillRect(150 + i*20, 760, 10, 10);
    }

    return canvas;
}

function generateCollisionMap() {
    const canvas = document.createElement('canvas');
    canvas.width = trackSize;
    canvas.height = trackSize;
    const ctx = canvas.getContext('2d');

    // Black background (off-track / walls)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, trackSize, trackSize);

    // Track path (white = drivable area)
    ctx.lineWidth = 140; // Same width as the outer borders
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff';

    ctx.beginPath();
    ctx.moveTo(200, 800);
    ctx.lineTo(200, 200);
    ctx.lineTo(800, 200);
    ctx.lineTo(800, 600);
    ctx.lineTo(500, 600);
    ctx.lineTo(500, 800);
    ctx.closePath();
    ctx.stroke();

    return canvas;
}

function generateCarSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Draw an F-Zero looking ship from behind/top
    ctx.fillStyle = '#000'; // shadow/outline

    // Main body
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(24, 16);
    ctx.lineTo(26, 28);
    ctx.lineTo(6, 28);
    ctx.lineTo(8, 16);
    ctx.fill();

    // Blue color
    ctx.fillStyle = '#2196F3';
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(22, 16);
    ctx.lineTo(24, 26);
    ctx.lineTo(8, 26);
    ctx.lineTo(10, 16);
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(16, 12);
    ctx.lineTo(20, 18);
    ctx.lineTo(12, 18);
    ctx.fill();

    // Engines
    ctx.fillStyle = '#ff5722';
    ctx.fillRect(10, 26, 4, 4);
    ctx.fillRect(18, 26, 4, 4);

    return canvas;
}

function generateSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128; // Sky is smaller vertically, wraps horizontally
    const ctx = canvas.getContext('2d');

    // Gradient background
    let gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, '#0a0a2a');
    gradient.addColorStop(1, '#ff6b6b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 128);

    // Simple city skyline
    ctx.fillStyle = '#111';
    for(let i=0; i<512; i+=20) {
        let h = Math.random() * 60 + 20;
        let w = Math.random() * 30 + 10;
        ctx.fillRect(i, 128 - h, w, h);

        // Windows
        if(Math.random() > 0.5) {
            ctx.fillStyle = '#ffeb3b';
            for(let wy=128-h+5; wy<120; wy+=10) {
                for(let wx=i+5; wx<i+w-5; wx+=8) {
                    if(Math.random() > 0.3) ctx.fillRect(wx, wy, 3, 5);
                }
            }
            ctx.fillStyle = '#111'; // reset
        }
    }

    return canvas;
}

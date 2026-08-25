// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.game = new Game();
    } catch (err) {
        console.error('Failed to start City Builder:', err);
        const box = document.getElementById('boot-error');
        if (box) {
            box.classList.remove('hidden');
            box.innerHTML = `
                <div>
                    <h2 style="margin-bottom:12px">City Builder failed to start</h2>
                    <p style="color:#8fa0b3">${String(err && err.message || err)}</p>
                    <p style="color:#8fa0b3;margin-top:8px">Check your internet connection (PixiJS loads from a CDN) and reload.</p>
                </div>`;
        }
    }
});

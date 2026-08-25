const MathUtils = {
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    distance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    distanceSq: (x1, y1, x2, y2) => (x2 - x1) ** 2 + (y2 - y1) ** 2,
    angleBetween: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    normalizeAngle: (angle) => {
        while (angle <= -Math.PI) angle += Math.PI * 2;
        while (angle > Math.PI) angle -= Math.PI * 2;
        return angle;
    },
    angleDiff: (a1, a2) => {
        let diff = a1 - a2;
        while (diff <= -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        return diff;
    },
    lerpAngle: (a, b, t) => a + MathUtils.angleDiff(b, a) * t,
    randRange: (min, max) => min + Math.random() * (max - min),
    formatTime: (t) => {
        if (t == null || !isFinite(t)) return '--:--.--';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const c = Math.floor((t * 100) % 100);
        return `${m}:${s.toString().padStart(2, '0')}.${c.toString().padStart(2, '0')}`;
    }
};

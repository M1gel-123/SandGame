const SIZE = 6;
const MACRO = 5; 
const W = 360 / SIZE;
const H = 540 / SIZE;

// colors are just hsl, id is used for matching when clearing
const COLORS = [
    { id: 1, h: 45, s: 90, l: 55 },  // yellow
    { id: 2, h: 0, s: 80, l: 55 },   // red
    { id: 3, h: 120, s: 70, l: 45 }, // green
    { id: 4, h: 210, s: 90, l: 60 }, // blue
    { id: 5, h: 280, s: 70, l: 60 }  // purple
];

// bunch of polyomino shapes
const SHAPES = [
    [[1,1,1],[0,1,0]],
    [[1,1],[1,1]],
    [[1,1,1,1]],
    [[1],[1],[1],[1]],
    [[1,1,1],[1,0,0]],
    [[1,1,1],[0,0,1]],
    [[1,1,0],[0,1,1]],
    [[0,1,1],[1,1,0]],
    [[1,1],[1,0]],
    [[0,1,0],[1,1,1],[0,1,0]],
    [[1,0,1],[1,1,1]],
    [[1,1,1,1,1]],
    [[1],[1],[1],[1],[1]],
    [[1,1,1],[1,1,1],[1,1,1]] 
];

const bg = document.getElementById('bg-canvas');
const bgCtx = bg.getContext('2d');
let bgParts = [];
let bgOn = false;

function resizeBg() {
    bg.width = window.innerWidth;
    bg.height = window.innerHeight;
}
window.addEventListener('resize', resizeBg);
resizeBg();

function makeBgPart() {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
        x: Math.random() * bg.width,
        y: Math.random() * bg.height - bg.height,
        size: 3 + Math.random() * 5,
        speed: 0.6 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 0.6,
        color: `hsla(${c.h}, ${c.s}%, ${c.l}%, ${0.25 + Math.random() * 0.45})`,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.04
    };
}

function startBg() {
    if (bgOn) return;
    bgOn = true;
    bgParts = [];
    for (let i = 0; i < 70; i++) {
        const p = makeBgPart();
        p.y = Math.random() * bg.height;
        bgParts.push(p);
    }
    bg.classList.add('active');
}

function drawBg() {
    if (!bgOn) return;
    bgCtx.clearRect(0, 0, bg.width, bg.height);
    // slight trail so it doesnt look too clean
    bgCtx.fillStyle = 'rgba(20,20,20,0.15)';
    bgCtx.fillRect(0, 0, bg.width, bg.height);
    for (const p of bgParts) {
        p.wobble += p.wobbleSpeed;
        p.x += p.drift + Math.sin(p.wobble) * 0.3;
        p.y += p.speed;
        if (p.y > bg.height + 10) {
            p.y = -10 - Math.random() * 40;
            p.x = Math.random() * bg.width;
        }
        if (p.x < -10) p.x = bg.width + 5;
        if (p.x > bg.width + 10) p.x = -5;
        bgCtx.fillStyle = p.color;
        bgCtx.fillRect(p.x, p.y, p.size, p.size);
    }
}

// main game
let grid = Array.from({ length: W }, () => Array(H).fill(null));
let particles = []; // the flying fx bits
let floaters = [];
let tray = [null, null, null];
let score = 0;
let streak = 1;
let best = 0;
let justCleared = false;
let needsSettle = false;
let lastDrip = 0;
let dripCounter = 0;
let gameOver = false;
let needPathCheck = false;
let wasMoving = false;
let dragging = false;
let dragIdx = -1;
let dragBlock = null;
let previewX = null;
let previewY = null;
let previewOk = false;
let mouseX = 0;
let mouseY = 0;
let anim = null;
let clearData = null;
let clearSet = new Set();
let fallingBlocks = [];
let scanDir = 1; // flip every frame so sand doesnt bias left/right

const board = document.getElementById('board');
const ctx = board.getContext('2d');
const trays = [
    document.getElementById('tray-0'),
    document.getElementById('tray-1'),
    document.getElementById('tray-2')
];
const dragC = document.getElementById('drag-canvas');

let audioCtx = null;
let masterGain = null;
let showingIntro = true;
let botTimer = 0;

const overlay = document.getElementById('intro-overlay');
const startBtn = document.getElementById('btn-start');

startBtn.onclick = () => {
    if (!showingIntro) return;
    showingIntro = false;
    overlay.classList.add('hidden');
    resetGame();
    initAudio();
    startBg();
};

// click anywhere on the dark overlay also starts
overlay.onclick = e => {
    if (e.target === overlay || (e.target.closest('#intro-overlay') && !e.target.closest('#btn-start'))) {
        startBtn.click();
    }
};

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = audioCtx.createDynamicsCompressor();
        comp.threshold.value = -10;
        comp.knee.value = 10;
        comp.ratio.value = 12;
        comp.attack.value = 0;
        comp.release.value = 0.25;
        comp.connect(audioCtx.destination);
        masterGain = audioCtx.createGain();
        masterGain.connect(comp);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// browsers are weird about autoplay so wait for first interaction
window.addEventListener('mousedown', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });

function dripSound() {
    if (!audioCtx) return;
    const now = performance.now();
    if (now - lastDrip < 60) return; // dont spam
    lastDrip = now;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.06, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const f = audioCtx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 600 + Math.random() * 400;
    f.Q.value = 2;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    src.connect(f);
    f.connect(g);
    g.connect(masterGain);
    src.start();
}

function clearSound(level) {
    if (!audioCtx) return;
    // rough major scale, higher streak = higher notes
const base = 300;
    const scale = [0, 3, 5, 7, 10, 12, 15, 17];
    const note = Math.min(level - 1, scale.length - 1);
    const pitch = base * Math.pow(2, scale[note] / 12);
    [pitch, pitch * 1.5].forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4 + i * 0.1);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(audioCtx.currentTime + i * 0.05);
        osc.stop(audioCtx.currentTime + 0.6);
    });
}

function Particle(c) {
    this.id = c.id;
    this.h = c.h + (Math.random() * 10 - 5);
    this.s = c.s + (Math.random() * 10 - 5);
    this.l = c.l + (Math.random() * 15 - 7);
    this.color = `hsl(${this.h}, ${this.s}%, ${this.l}%)`;
    this.isParticle = true;
}

function Block(c, shape, x, y) {
    this.color = c;
    this.shape = shape;
    this.x = x;
    this.y = y;
    this.falling = true;
    this.w = shape[0].length * MACRO;
    this.h = shape.length * MACRO;
}

Block.prototype.hits = function(gx, gy) {
    for (let r = 0; r < this.shape.length; r++) {
        for (let c = 0; c < this.shape[0].length; c++) {
            if (!this.shape[r][c]) continue;
            for (let mr = 0; mr < MACRO; mr++) {
                for (let mc = 0; mc < MACRO; mc++) {
                    const tx = gx + c * MACRO + mc;
                    const ty = gy + r * MACRO + mr;
                    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return true;
                    if (grid[tx][ty]) return true;
                }
            }
        }
    }
    //  check against other falling blocks so they dont phase through each other
    for (const other of fallingBlocks) {
        if (other === this || !other.falling) continue;
        for (let r = 0; r < this.shape.length; r++) {
            for (let c = 0; c < this.shape[0].length; c++) {
                if (!this.shape[r][c]) continue;
                for (let mr = 0; mr < MACRO; mr++) {
                    for (let mc = 0; mc < MACRO; mc++) {
                        const tx1 = gx + c * MACRO + mc;
                        const ty1 = gy + r * MACRO + mr;
                        for (let r2 = 0; r2 < other.shape.length; r2++) {
                            for (let c2 = 0; c2 < other.shape[0].length; c2++) {
                                if (!other.shape[r2][c2]) continue;
                                for (let mr2 = 0; mr2 < MACRO; mr2++) {
                                    for (let mc2 = 0; mc2 < MACRO; mc2++) {
                                        if (tx1 === other.x + c2 * MACRO + mc2 &&
                                            ty1 === other.y + r2 * MACRO + mr2) return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return false;
};

Block.prototype.fall = function() {
    if (!this.falling) return false;
    if (this.y + this.h >= H || this.hits(this.x, this.y + 1)) {
        this.falling = false;
        return false;
    }
    this.y++;
    return true;
};

Block.prototype.breakApart = function() {
    // turn the whole shape into individual sand particles
    for (let r = 0; r < this.shape.length; r++) {
        for (let c = 0; c < this.shape[0].length; c++) {
            if (!this.shape[r][c]) continue;
            for (let mr = 0; mr < MACRO; mr++) {
                for (let mc = 0; mc < MACRO; mc++) {
                    const tx = this.x + c * MACRO + mc;
                    const ty = this.y + r * MACRO + mr;
                    if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
                        grid[tx][ty] = new Particle(this.color);
                    }
                }
            }
        }
    }
};

function fillTray() {
    for (let i = 0; i < 3; i++) {
        tray[i] = {
            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        };
        drawTray(trays[i], tray[i]);
        trays[i].style.pointerEvents = 'auto';
        trays[i].style.opacity = '1';
    }
}

function drawTray(canvas, b) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    if (!b) return;
    const cs = 18;
    const w = b.shape[0].length * cs;
    const h = b.shape.length * cs;
    const ox = (canvas.width - w) / 2;
    const oy = (canvas.height - h) / 2;
    c.fillStyle = `hsl(${b.color.h}, ${b.color.s}%, ${b.color.l}%)`;
    c.strokeStyle = '#000';
    c.lineWidth = 1;
    for (let r = 0; r < b.shape.length; r++) {
        for (let col = 0; col < b.shape[0].length; col++) {
            if (b.shape[r][col]) {
                c.fillRect(ox + col * cs, oy + r * cs, cs, cs);
                c.strokeRect(ox + col * cs, oy + r * cs, cs, cs);
            }
        }
    }
}

function updateBlocks() {
    let moved = false;
    let landed = false;
    for (let i = fallingBlocks.length - 1; i >= 0; i--) {
        const b = fallingBlocks[i];
        if (!b.falling) continue;
        if (b.fall()) {
            moved = true;
        } else {
            b.breakApart();
            fallingBlocks.splice(i, 1);
            landed = true;
            needPathCheck = true;
            justCleared = false;
            needsSettle = true;
        }
    }
    return moved || landed;
}

function updateSand() {
    let moved = false;
    let dripped = false;
    scanDir *= -1; // alternate direction so piles stay roughly symmetric

    // first just let everything fall straight down (2x speed)
    for (let step = 0; step < 2; step++) {
        for (let y = H - 2; y >= 0; y--) {
            for (let i = 0; i < W; i++) {
                const x = scanDir === 1 ?i : W - 1 - i;
                const p = grid[x][y];
                if (p && p.isParticle && !grid[x][y + 1]) {
                    grid[x][y + 1] = p;
                    grid[x][y] = null;
                    moved = true;
                }
            }
        }
    }

    // every few frames try to slide sideways if blocked
    dripCounter++;
    if (dripCounter >= 3) {
        dripCounter = 0;
        for (let y = H - 2; y >= 0; y--) {
            for (let i = 0; i < W; i++) {
                const x = scanDir === 1 ?i : W - 1 - i;
                const p = grid[x][y];
                if (!p || !p.isParticle) continue;
                if (y + 1 >= H || grid[x][y + 1]) {
                    let left = x > 0 && y + 1 < H && !grid[x - 1][y + 1];
                    let right = x < W - 1 && y + 1 < H && !grid[x + 1][y + 1];
                    if (left && right) {
                        // random pick so it doesnt always prefer one side
                        if (Math.random() > 0.5) left = false;
                        else right = false;
                    }
                    if (left) {
                        grid[x - 1][y + 1] = p;
                        grid[x][y] = null;
                        moved = true;
                        dripped = true;
                    } else if (right) {
                        grid[x + 1][y + 1] = p;
                        grid[x][y] = null;
                        moved = true;
                        dripped = true;
                    }
                }
            }
        }
    }

    if (dripped) dripSound();
    return moved;
}

// flood fill from the left wall looking for same color paths that reach the right
function checkPaths() {
    if (clearData) return 0;
    const visited = Array.from({ length: W }, () => Array(H).fill(false));
    const toClear = [];
    let pathsFound = 0;

    for (let y = 0; y < H; y++) {
        const p = grid[0][y];
        if (!p || !p.isParticle || visited[0][y]) continue;
        const queue = [{ x: 0, y }];
        const component = [];
        visited[0][y] = true;
        let reachedRight = false;
        let head = 0;
        while (head < queue.length) {
            const cur = queue[head++];
            component.push(cur);
            if (cur.x === W - 1) reachedRight = true;
            // 8 way connectivity feels better than 4
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (!dx && !dy) continue;
                    const nx = cur.x + dx;
                    const ny = cur.y + dy;
                    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                    if (!visited[nx][ny] && grid[nx][ny] && grid[nx][ny].isParticle && grid[nx][ny].id === p.id) {
                        visited[nx][ny] = true;
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }
        if (reachedRight) {
            toClear.push(...component);
            pathsFound++;
        }
    }

    if (toClear.length) {
        clearData = { particles: toClear, timer: 15, paths: pathsFound };
        clearSet = new Set(toClear.map(p => p.x + ',' + p.y));
        return pathsFound;
    }
    return 0;
}

function spawnFx(gx, gy, color) {
    if (Math.random() > 0.4) return; // dont spawn too many
    particles.push({
        x: gx * SIZE,
        y: gy * SIZE,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 1.5) * 8,
        life: 1,
        color
    });
}

function addFloater(text, x, y) {
    floaters.push({ text, x, y, a: 1 });
}

function updateFx() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5;
        p.life -= 0.04;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.y -= 1.5;
        f.a -= 0.03;
        if (f.a <= 0) floaters.splice(i, 1);
    }
}

function canPlace(shape, mx, my) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[0].length; c++) {
            if (!shape[r][c]) continue;
            for (let mr = 0; mr < MACRO; mr++) {
                for (let mc = 0; mc < MACRO; mc++) {
                    const tx = mx * MACRO + c * MACRO + mc;
                    const ty = my * MACRO + r * MACRO + mr;
                    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return false;
                    if (grid[tx][ty]) return false;
                    // also dont place on top of currently falling blocks
                     for (const b of fallingBlocks) {
                        for (let r2 = 0; r2 < b.shape.length; r2++) {
                            for (let c2 = 0; c2 < b.shape[0].length; c2++) {
                                if (!b.shape[r2][c2]) continue;
                                for (let mr2 = 0; mr2 < MACRO; mr2++) {
                                    for (let mc2 = 0; mc2 < MACRO; mc2++) {
                                        if (tx === b.x + c2 * MACRO + mc2 &&
                                            ty === b.y + r2 * MACRO + mr2) return false;
                                    }
                                }
                            }
                        }
}
                }
            }
        }
    }
    return true;
}

function startDrag(e, i) {
    if (gameOver || dragging || !tray[i] || anim || showingIntro) return;
    initAudio();
    dragging = true;
    dragIdx = i;
    dragBlock = tray[i];
    dragC.style.display = 'block';
    drawTray(dragC, dragBlock);
    moveDrag(e);
    trays[i].style.opacity = '0.35';
}

function moveDrag(e) {
    mouseX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    mouseY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    dragC.style.left = mouseX + 'px';
    dragC.style.top = mouseY + 'px';
}

function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    moveDrag(e);
    const rect = board.getBoundingClientRect();
    let px = (mouseX - rect.left) * (board.width / rect.width);
    let py = (mouseY - rect.top) * (board.height / rect.height);
    px = Math.max(0, Math.min(px, board.width));
    py = Math.max(0, Math.min(py, board.height));

    const shape = dragBlock.shape;
    let tx = Math.floor(px / (SIZE * MACRO)) - Math.floor(shape[0].length / 2);
    let ty = Math.floor(py / (SIZE * MACRO)) - Math.floor(shape.length / 2);
    tx = Math.max(0, Math.min(tx, W / MACRO - shape[0].length));
    ty = Math.max(0, Math.min(ty, H / MACRO - shape.length));

    // drop as low as possible from the mouse position
    let goodY = -1;
    for (let y = ty; y >= 0; y--) {
        if (canPlace(shape, tx, y)) {
            goodY = y;
            break;
        }
    }

    if (goodY !== -1) {
        previewX = tx * MACRO;
        previewY = goodY * MACRO;
        previewOk = true;
    } else {
        previewX = null;
        previewY = null;
        previewOk = false;
    }
}

function endDrag() {
    if (!dragging) return;
    dragging = false;
    dragC.style.display = 'none';
    if (previewOk && previewX !== null && !showingIntro) {
        startAnim();
    } else {
        trays[dragIdx].style.opacity = '1';
    }
    previewX = null;
    previewY = null;
}

trays.forEach((c, i) => {
    c.addEventListener('mousedown', e => startDrag(e, i));
    c.addEventListener('touchstart', e => startDrag(e, i), { passive: false });
});
window.addEventListener('mousemove', onMove, { passive: false });
window.addEventListener('touchmove', onMove, { passive: false });
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function startAnim() {
    const rect = board.getBoundingClientRect();
    let px = (mouseX - rect.left) * (board.width / rect.width);
    let py = (mouseY - rect.top) * (board.height / rect.height);
    const sw = dragBlock.shape[0].length * MACRO * SIZE;
    const sh = dragBlock.shape.length * MACRO * SIZE;
    anim = {
        shape: dragBlock.shape,
        color: dragBlock.color,
        sx: px - sw / 2,
        sy: py - sh / 2,
        x: px - sw / 2,
        y: py - sh / 2,
        tx: previewX * SIZE,
        ty: previewY * SIZE,
        gx: previewX,
        gy: previewY,
        t: 0,
        idx: dragIdx,
        isBot: false,
        spd: 0.15
    };
    tray[dragIdx] = null;
    trays[dragIdx].style.pointerEvents = 'none';
    drawTray(trays[dragIdx], null);
}

// the little auto-player for the intro screen
function botPlace() {
    if (!showingIntro || gameOver || anim || clearData) return false;
    let idx = -1;
    for (let i = 0; i < 3; i++) {
        if (tray[i]) {
            idx = i;
            break;
        }
    }
    if (idx === -1) {
        fillTray();
        for (let i = 0; i < 3; i++) {
            if (tray[i]) {
                idx = i;
                break;
            }
        }
        if (idx === -1) return false;
    }

    const b = tray[idx];
    const shape = b.shape;
    const maxX = Math.floor(W / MACRO) - shape[0].length;
    const maxY = Math.floor(H / MACRO) - shape.length;

    // just random spots
    for (let n = 0; n < 60; n++) {
        const mx = Math.floor(Math.random() * (maxX + 1));
        const my = Math.floor(Math.random() * (maxY + 1));
        if (canPlace(shape, mx, my)) {
            const tx = mx * MACRO * SIZE;
            const ty = my * MACRO * SIZE;
            anim = {
                shape,
                color: b.color,
                sx: tx + (Math.random() - 0.5) * 120,
                sy: -shape.length * MACRO * SIZE - 20 - Math.random() * 40,
                x: tx + (Math.random() - 0.5) * 120,
                y: -shape.length * MACRO * SIZE - 20 - Math.random() * 40,
                tx,
                ty,
                gx: mx * MACRO,
                gy: my * MACRO,
                t: 0,
                idx,
                isBot: true,
                spd: 0.22 + Math.random() * 0.08
            };
            tray[idx] = null;
            trays[idx].style.pointerEvents = 'none';
            drawTray(trays[idx], null);
            return true;
        }
    }
    return false;
}

function commitBlock() {
    fallingBlocks.push(new Block(anim.color, anim.shape, anim.gx, anim.gy));
    if (!anim.isBot) {
        score += 15;
        updateUI();
    }
    anim = null;
    if (tray.every(b => !b)) fillTray();
    if (!showingIntro) checkGameOver();
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('streak').textContent = 'x' + streak;
    document.getElementById('best').textContent = best;
}

function loadBest() {
    try {
        best = parseInt(localStorage.getItem('sandGameHighScore'), 10) || 0;
    } catch (e) {
        best = 0;
    }
    updateUI();
}

function saveBest() {
    try {
        localStorage.setItem('sandGameHighScore', best);
    } catch (e) {}
}

function shapeFitsSomewhere(shape) {
    for (let my = 0; my <= H / MACRO - shape.length; my++) {
        for (let mx = 0; mx <= W / MACRO - shape[0].length; mx++) {
            if (canPlace(shape, mx, my)) return true;
        }
    }
    return false;
}

function triggerGameOver() {
    gameOver = true;
    // gray out
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
            if (grid[x][y] && grid[x][y].isParticle) grid[x][y].color = '#444';
        }
    }
    document.getElementById('final-score').textContent = score;
    const nb = document.getElementById('new-best');
    const bi = document.getElementById('best-info');
    if (score > best) {
        best = score;
        saveBest();
        updateUI();
        nb.style.display = 'block';
        bi.textContent = 'You beat your previous best!';
    } else {
        nb.style.display = 'none';
        bi.textContent = best > 0 ?'Best: ' + best : '';
    }
    const go = document.getElementById('game-over');
    go.style.display = 'block';
    go.classList.add('show');
}

function checkGameOver() {
    if (showingIntro) return;
    for (const b of tray) {
        if (b && shapeFitsSomewhere(b.shape)) return;
    }
    triggerGameOver();
}

function resetGame() {
    grid = Array.from({ length: W }, () => Array(H).fill(null));
    fallingBlocks = [];
    score = 0;
    streak = 1;
    gameOver = false;
    anim = null;
    clearData = null;
    clearSet.clear();
    wasMoving = false;
    needPathCheck = false;
    needsSettle = false;
    updateUI();
    const go = document.getElementById('game-over');
    go.classList.remove('show');
    document.getElementById('new-best').style.display = 'none';
    document.getElementById('best-info').textContent = '';
    setTimeout(() => go.style.display = 'none', 300);
    for (let i = 0; i < 3; i++) {
        tray[i] = null;
        trays[i].style.opacity = '1';
        trays[i].style.pointerEvents = 'auto';
    }
    fillTray();
}

function draw() {
    ctx.clearRect(0, 0, board.width, board.height);

    // faint grid so you can see the cells
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += MACRO) {
        ctx.beginPath();
        ctx.moveTo(x * SIZE, 0);
        ctx.lineTo(x * SIZE, board.height);
        ctx.stroke();
    }
    for (let y = 0; y <= H; y += MACRO) {
        ctx.beginPath();
        ctx.moveTo(0, y * SIZE);
        ctx.lineTo(board.width, y * SIZE);
        ctx.stroke();
    }

    // sand
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
            const cell = grid[x][y];
            if (!cell || !cell.isParticle) continue;
            if (clearData && clearSet.has(x + ',' + y)) {
                // flash white/yellow while clearing
                ctx.fillStyle = (Math.floor(clearData.timer / 2) % 2 === 0) ?'#fff' : '#eab308';
            } else {
                ctx.fillStyle = cell.color;
            }
            ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);
        }
    }

    // still falling solid blocks
    for (const b of fallingBlocks) {
        const cs = MACRO * SIZE;
        ctx.fillStyle = `hsl(${b.color.h}, ${b.color.s}%, ${b.color.l}%)`;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        for (let r = 0; r < b.shape.length; r++) {
            for (let c = 0; c < b.shape[0].length; c++) {
                if (!b.shape[r][c]) continue;
                const px = (b.x + c * MACRO) * SIZE;
                const py = (b.y + r * MACRO) * SIZE;
                ctx.fillRect(px, py, cs, cs);
                ctx.strokeRect(px, py, cs, cs);
            }
        }
    }

    // placement preview
    if (dragging && previewOk && previewX !== null && !showingIntro) {
        const shape = dragBlock.shape;
        const cs = MACRO * SIZE;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[0].length; c++) {
                if (!shape[r][c]) continue;
                const px = (previewX + c * MACRO) * SIZE;
                const py = (previewY + r * MACRO) * SIZE;
                ctx.fillStyle = `hsl(${dragBlock.color.h}, ${dragBlock.color.s}%, ${dragBlock.color.l}%)`;
                ctx.globalAlpha = 0.45;
                ctx.fillRect(px, py, cs, cs);
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
            }
        }
        ctx.globalAlpha = 1;
    }

    // the flying animation
    if (anim) {
        const shape = anim.shape;
        const cs = MACRO * SIZE;
        ctx.globalAlpha = 0.85;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[0].length; c++) {
                if (!shape[r][c]) continue;
                const px = anim.x + c * cs;
                const py = anim.y + r * cs;
                ctx.fillStyle = `hsl(${anim.color.h}, ${anim.color.s}%, ${anim.color.l}%)`;
                ctx.fillRect(px, py, cs, cs);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
            }
        }
        ctx.globalAlpha = 1;
    }

    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, SIZE, SIZE);
    }
    ctx.globalAlpha = 1;

    ctx.font = 'bold 18px Courier New';
    for (const f of floaters) {
        ctx.globalAlpha = f.a;
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
}

function loop() {
    requestAnimationFrame(loop);

    // intro random blocks
    if (showingIntro && !gameOver) {
        botTimer += 16;
        if (botTimer >= 420) {
            botTimer = 0;
            if (!anim && !clearData) {
                if (!botPlace()) {
                    if (tray.every(b => !b)) fillTray();
                    if (!clearData) checkPaths();
                }
            }
        }
    }

    if (anim) {
        const spd = anim.isBot ?anim.spd : 0.15;
        anim.t += spd;
        anim.x += (anim.tx - anim.x) * Math.min(0.4, spd * 2.2);
        anim.y += (anim.ty - anim.y) * Math.min(0.4, spd * 2.2);
        if (Math.hypot(anim.tx - anim.x, anim.ty - anim.y) < 2 || anim.t >= 2) {
            anim.x = anim.tx;
            anim.y = anim.ty;
            commitBlock();
        }
    }

    if (clearData) {
        clearData.timer--;
        if (clearData.timer <= 0) {
            for (const pos of clearData.particles) {
                const cell = grid[pos.x][pos.y];
                if (cell && cell.isParticle) {
                    spawnFx(pos.x, pos.y, cell.color);
                    grid[pos.x][pos.y] = null;
                }
            }
            if (!justCleared) justCleared = true;
            clearSound(streak);
            const pts = clearData.paths * 150 * streak;
            score += pts;
            addFloater('+' + pts, 80, 150);
            updateUI();
            clearData = null;
            clearSet.clear();
            wasMoving = true;
        }
    }

    if (!gameOver && !clearData) {
        const blocksMoved = updateBlocks();
        const sandMoved = updateSand();
        if (blocksMoved || sandMoved) {
            wasMoving = true;
        } else if (wasMoving || needPathCheck) {
            wasMoving = false;
            needPathCheck = false;
            const paths = checkPaths();
            if (paths === 0 && needsSettle && !anim) {
                // no clear happened after things settled, reset streak
                if (!justCleared) streak = 1;
                else streak++;
                updateUI();
                needsSettle = false;
            }
        }
    }

    updateFx();
    draw();
    drawBg();
}

loadBest();
fillTray();
loop();

setTimeout(() => {
    if (showingIntro && !anim) botPlace();
}, 300);
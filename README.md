# Sand Game

A falling-sand puzzle game where polyomino blocks shatter into colored particles. Connect same-color paths from the left wall to the right wall to clear them and chain high scores.

## How to Play

1. Drag a piece from the bottom tray onto the board. 2. The piece drops as a solid block, then breaks into individual sand particles. 3. Sand falls and slides under gravity. 4. When a continuous path of the **same color** reaches from the left edge to the right edge, that path clears. 5. Chain clears to build a streak multiplier. 6. Game ends when none of the three tray pieces can be placed.

## Physics

The board is a grid of `W × H` cells (`60 × 90`). Each polyomino is built from `MACRO × MACRO` (5×5) solid blocks that later become individual particles. ### Falling blocks
Solid pieces fall one cell at a time until they hit something, then disintegrate:

```js
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
```

### Sand simulation
Particles first fall straight down (2 steps per frame).Every few frames they try to slide left or right when blocked:

```js
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
if (dripCounter >= 3) {
    // … left / right diagonal slide with random choice when both sides are free
}
```

`scanDir` flips every frame so piles stay roughly symmetric instead of always favoring one side. ### Path clearing
A flood-fill starts from every particle on the left wall.8-way connectivity is used. If the component reaches the right wall, the whole path is marked for clearing:

```js
// 8 way connectivity feels better than 4
for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (!visited[nx][ny] && grid[nx][ny] && grid[nx][ny].isParticle
            && grid[nx][ny].id === p.id) {
            visited[nx][ny] = true;
            queue.push({ x: nx, y: ny });
            }
    }
}
```

Cleared particles flash, spawn particle FX, and award `paths × 150 × streak` points.

## Features

| Feature | Description |
|---------|-------------|
| **Piece tray** | Three random polyominoes (14 shapes) in five colors |
| **Drag & drop** | Live placement preview; piece drops to the lowest valid Y |
| **Solid → sand** | Blocks fall as solids, then shatter into particles |
| **Path clears** | Same-color left-to-right connections clear with streak multiplier |
| **Audio** | Procedural drip sounds + rising major-scale clear tones |
| **Background** | Soft floating color particles after the intro |
| **High score** | Stored in `localStorage` |
| **Intro demo** | Auto-player places random pieces until you press Start |
| **Game over** | Triggers when no tray piece fits anywhere on the board |

### Shapes & colors

```js
const COLORS = [
    { id: 1, h: 45,  s: 90, l: 55 },  // yellow
    { id: 2, h: 0,   s: 80, l: 55 },  // red
    { id: 3, h: 120, s: 70, l: 45 },  // green
    { id: 4, h: 210, s: 90, l: 60 },  // blue
    { id: 5, h: 280, s: 70, l: 60 }   // purple
];

const SHAPES = [
    [[1,1,1],[0,1,0]],          // T
    [[1,1],[1,1]],              // O
    [[1,1,1,1]],                // I (horizontal)
    [[1],[1],[1],[1]],          // I (vertical)
    // … 10 more polyominoes including the 3×3 square
];
```

---

## Project structure

```
├── index.html   # markup + canvas elements
├── style.css    # layout, intro overlay, game-over panel
└── script.js    # all game logic, physics, audio, rendering
```

No build step or dependencies required.---

## Controls

- **Mouse / touch** – drag pieces from the tray onto the board
- **Start button** (or click the dark overlay) – leave the intro demo and begin scoring

---

*Built with vanilla JavaScript, Canvas 2D, and Web Audio API.*

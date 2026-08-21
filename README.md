# Sand Game

A little sand puzzle game built with JavaScript. Drag random pieces onto the board—they fall as solid blocks, then break into tiny sand particles. Connect sand from the left side to the right to clear it and earn points. The game ends when you can't place any of the three pieces.

## How It Works

- **Board:** 60 cells wide × 90 cells high.
- **Pieces:** 14 different shapes, each made of smaller blocks. When a piece lands, it shatters into individual sand particles.
- **Sand Physics:** Particles fall straight down, but can move diagonally when blocked. The update direction alternates to keep behavior varied.
- **Connection Check:** A flood fill starts from sand on the left edge, checking all 8 directions (including diagonals). If it reaches the right edge, all connected sand of that color is cleared.
- **Colors:** Yellow, Red, Green, Blue, Purple — each with a unique ID for easy matching.

## Scoring

- Points are awarded for each cleared path.
- High score is saved in `localStorage`, so it persists across sessions.

## Sound & Effects

- Simple sounds generated with the Web Audio API:
  - Sand falling sounds
  - Path-clear sounds that change pitch based on your streak
- Small particle effects appear when sand is cleared.

## Tech Stack

- **HTML** – page structure and canvas
- **CSS** – UI and layout
- **JavaScript** – game logic, rendering, and everything else
- **Canvas 2D** – rendering
- **Web Audio API** – sound generation
- **localStorage** – high score persistence

## Files
- `index.html`
- `script.js`
- `style.css`

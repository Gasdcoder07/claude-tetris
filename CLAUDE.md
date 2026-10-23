# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla-JS Tetris (HTML5 Canvas + CSS). No `package.json`, no bundler, no transpiler, no test suite, no linter. Three source files: `index.html`, `style.css`, `game.js`.

UI strings and the README are in Spanish; keep new user-facing text in Spanish.

## Running

```bash
open index.html            # macOS — works directly, no server needed
python3 -m http.server 8000  # or any static server, then http://localhost:8000
```

Verification is manual: open the page and play. There is no automated test command.

## Architecture (`game.js`)

A single classic-script file (not a module) with top-level `let` game state — `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`. Everything is global by design; `init()` resets all of it and is also the restart-button handler.

Key invariants to preserve when editing:

- **Piece shapes carry their own color index.** `PIECES[n]` is filled with the value `n` (not `1`), and `COLORS` is 1-indexed with `null` at slot 0. So a board cell and a shape cell are the same kind of value: `0` = empty, `1–7` = color. `drawBlock` relies on this and no-ops on `0`. If you add a piece, its matrix must be filled with its own index and `COLORS` extended at the matching position.
- **Rotation is matrix-based**, `rotateCW` = transpose + row-reverse on the square matrix, so the piece's "state" is only its current matrix — there is no rotation counter. Wall kicks in `tryRotate` are an ad-hoc `[0,-1,1,-2,2]` horizontal scan, not SRS kick tables.
- **Canvas sizes are hardcoded in `index.html`** (`300×600` board, `120×120` next). Changing `COLS`, `ROWS`, or `BLOCK` requires editing those attributes to match `COLS*BLOCK × ROWS*BLOCK`; the next-preview assumes a 4×4 grid at `NB = 30`.
- **`collide` tolerates negative `y`** (`ny >= 0` guard) so pieces can be partly above the board, but does **not** guard the top edge — only floor, walls, and occupied cells.
- **The loop is start/stop, not a flag check.** `loop` never inspects `paused`/`gameOver`; pausing and game-over call `cancelAnimationFrame(animId)`, and `togglePause` restarts by resetting `lastTime` and calling `loop` directly. Any new "stop the game" path must cancel the frame, and any resume path must reset `lastTime` or `dt` jumps by the whole pause duration.
- **`clearLines` splices in place** and re-checks the same index (`r++` after removal) so stacked completed rows are all caught.
- **The single overlay element is shared** by PAUSE and GAME OVER; the state is distinguished only by `overlayTitle`/`overlayScore` text plus the `gameOver` flag.

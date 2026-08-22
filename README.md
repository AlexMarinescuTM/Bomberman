# Bomberman

A browser-based Bomberman clone built with React, TypeScript, and Vite. Bomb your way through a procedurally generated grid, break crates for power-ups, and clear the enemies before they catch you.

## Playing it

Requires [Node.js](https://nodejs.org/) 22 or later.

```bash
git clone https://github.com/AlexMarinescuTM/Bomberman.git
cd Bomberman
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and prints a local URL (typically `http://localhost:5173`) — open it in a browser to play.

**Controls:** Arrow keys / WASD to move, Space to place a bomb.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Type-checks the project and builds a production bundle to `dist/` |
| `npm run preview` | Serves that production build locally |
| `npm test` | Runs the test suite (Vitest) |
| `npm run lint` | Runs ESLint |

## Branches

- **`dev`** — active development happens here. Open pull requests against `dev`.
- **`main`** — kept in sync with `dev` and promoted via pull request once changes are ready.

Every push to `dev`, and every pull request into `dev` or `main`, runs the test suite automatically via GitHub Actions (see [`.github/workflows/test.yml`](.github/workflows/test.yml)).

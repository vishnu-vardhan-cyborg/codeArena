import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/PowerUpHunt.css";

const GRID_WIDTH = 18;
const GRID_HEIGHT = 12;
const START_SECONDS = 75;
const START_POSITION = { x: 1, y: 1 };
const INITIAL_POWER_UPS = [
  { x: 15, y: 1, type: "aura" },
  { x: 8, y: 3, type: "energy" },
  { x: 2, y: 6, type: "boost" },
  { x: 13, y: 7, type: "aura" },
  { x: 7, y: 10, type: "energy" },
];
const TREE_POSITIONS = new Set([
  "4-0", "9-0", "13-0", "16-0", "4-1", "9-1", "12-1", "4-2", "6-2",
  "12-2", "16-2", "1-3", "4-3", "12-3", "16-3", "1-4", "7-4", "8-4",
  "9-4", "12-4", "15-4", "4-5", "9-5", "12-5", "15-5", "4-6", "9-6",
  "15-6", "1-7", "4-7", "7-7", "8-7", "9-7", "16-7", "1-8", "12-8",
  "16-8", "4-9", "7-9", "12-9", "16-9", "4-10", "10-10", "13-10",
  "1-11", "5-11", "10-11", "15-11",
]);

const directions = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

const positionKey = (position) => `${position.x}-${position.y}`;

export default function PowerUpHunt() {
  const navigate = useNavigate();
  const [player, setPlayer] = useState(START_POSITION);
  const [powerUps, setPowerUps] = useState(INITIAL_POWER_UPS);
  const [seconds, setSeconds] = useState(START_SECONDS);
  const [lastDirection, setLastDirection] = useState({ x: 1, y: 0 });
  const [steps, setSteps] = useState(0);

  const status =
    powerUps.length === 0 ? "Forest cleared" : seconds === 0 ? "Time up" : "Hunting";
  const gameActive = powerUps.length > 0 && seconds > 0;
  const collected = INITIAL_POWER_UPS.length - powerUps.length;

  const movePlayer = useCallback(
    (direction, distance = 1) => {
      if (!gameActive) return;

      setLastDirection(direction);
      setPlayer((current) => {
        let next = current;

        for (let step = 0; step < distance; step += 1) {
          const candidate = {
            x: Math.max(0, Math.min(GRID_WIDTH - 1, next.x + direction.x)),
            y: Math.max(0, Math.min(GRID_HEIGHT - 1, next.y + direction.y)),
          };

          if (TREE_POSITIONS.has(positionKey(candidate))) break;
          next = candidate;
        }

        if (next.x !== current.x || next.y !== current.y) {
          setSteps((value) => value + 1);
          setPowerUps((items) =>
            items.filter((item) => positionKey(item) !== positionKey(next))
          );
        }

        return next;
      });
    },
    [gameActive]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (directions[key]) {
        event.preventDefault();
        movePlayer(directions[key]);
      }

      if (key === "z") {
        event.preventDefault();
        movePlayer(lastDirection, 2);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lastDirection, movePlayer]);

  useEffect(() => {
    if (!gameActive) return undefined;

    const timer = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameActive]);

  const resetGame = () => {
    setPlayer(START_POSITION);
    setPowerUps(INITIAL_POWER_UPS);
    setSeconds(START_SECONDS);
    setLastDirection({ x: 1, y: 0 });
    setSteps(0);
  };

  const tiles = useMemo(
    () =>
      Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, (_, index) => ({
        x: index % GRID_WIDTH,
        y: Math.floor(index / GRID_WIDTH),
      })),
    []
  );

  return (
    <div className="power-hunt-page">
      <header className="power-hunt-header">
        <button type="button" onClick={() => navigate("/home")}>
          <ArrowLeft size={18} />
          Home
        </button>
        <div>
          <span>Mini game / Prototype</span>
          <h1>Power Up Hunt</h1>
          <p>Guide Nova through the forest and recover every power core.</p>
        </div>
        <button type="button" onClick={resetGame}>
          <RotateCcw size={18} />
          Reset
        </button>
      </header>

      <main className="power-hunt-layout">
        <section className="power-game-panel">
          <div className="power-game-hud">
            <div>
              <span>Status</span>
              <strong>{status}</strong>
            </div>
            <div>
              <span>Power</span>
              <strong>{collected * 100}</strong>
            </div>
            <div>
              <span>Cores</span>
              <strong>{collected}/{INITIAL_POWER_UPS.length}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{seconds}s</strong>
            </div>
          </div>

          <div
            className="forest-board"
            style={{
              "--grid-width": GRID_WIDTH,
              "--grid-height": GRID_HEIGHT,
            }}
            role="application"
            aria-label="Power Up Hunt game board"
          >
            {tiles.map((tile) => {
              const key = positionKey(tile);
              const powerUp = powerUps.find((item) => positionKey(item) === key);
              const hasPlayer = player.x === tile.x && player.y === tile.y;

              return (
                <div
                  className={`forest-tile ${TREE_POSITIONS.has(key) ? "tree-tile" : ""}`}
                  key={key}
                >
                  {TREE_POSITIONS.has(key) && (
                    <span className="pixel-tree" aria-hidden="true" />
                  )}
                  {powerUp && (
                    <span
                      className={`pixel-power-up ${powerUp.type}`}
                      title={`${powerUp.type} power-up`}
                    />
                  )}
                  {hasPlayer && (
                    <span className="pixel-scout" title="Nova">
                      <i />
                      <b />
                      <em />
                    </span>
                  )}
                </div>
              );
            })}
            {!gameActive && (
              <div className="game-result">
                <Zap size={28} />
                <strong>{status}</strong>
                <span>
                  {powerUps.length === 0
                    ? `${collected * 100} power collected in ${steps} moves`
                    : `${collected} cores recovered`}
                </span>
                <button type="button" onClick={resetGame}>
                  Hunt again
                </button>
              </div>
            )}
          </div>

          <div className="touch-game-controls" aria-label="Game controls">
            <button
              type="button"
              aria-label="Move up"
              onClick={() => movePlayer(directions.ArrowUp)}
            >
              <ArrowUp size={18} />
            </button>
            <button
              type="button"
              aria-label="Move left"
              onClick={() => movePlayer(directions.ArrowLeft)}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              className="dash-control"
              type="button"
              aria-label="Dash"
              onClick={() => movePlayer(lastDirection, 2)}
            >
              Z
            </button>
            <button
              type="button"
              aria-label="Move right"
              onClick={() => movePlayer(directions.ArrowRight)}
            >
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              aria-label="Move down"
              onClick={() => movePlayer(directions.ArrowDown)}
            >
              <ArrowDown size={18} />
            </button>
          </div>
        </section>

        <aside className="power-game-sidebar">
          <span className="game-eyebrow">Forest scout</span>
          <h2>Nova</h2>
          <p>
            A fast arena scout built to find unstable power cores before the
            forest reclaims them.
          </p>

          <div className="scout-preview">
            <span className="pixel-scout preview-scout">
              <i />
              <b />
              <em />
            </span>
          </div>

          <div className="game-control-list">
            <span>Controls</span>
            <div><kbd>WASD</kbd><strong>Move</strong></div>
            <div><kbd>Arrows</kbd><strong>Move</strong></div>
            <div><kbd>Z</kbd><strong>Dash</strong></div>
          </div>

          <div className="power-legend">
            <span>Power cores</span>
            <div><i className="energy" /><strong>Energy</strong></div>
            <div><i className="aura" /><strong>Aura</strong></div>
            <div><i className="boost" /><strong>Boost</strong></div>
          </div>
        </aside>
      </main>
    </div>
  );
}

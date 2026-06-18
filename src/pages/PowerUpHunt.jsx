import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  Zap,
} from "lucide-react";
import { supabase } from "../supabase";
import "../styles/PowerUpHunt.css";

const VIEW_WIDTH = 19;
const VIEW_HEIGHT = 13;
const CENTER_X = Math.floor(VIEW_WIDTH / 2);
const CENTER_Y = Math.floor(VIEW_HEIGHT / 2);
const START_POSITION = { x: 0, y: 0 };
const SHARE_AMOUNT = 25;

const POWER_UPS = {
  freeze: {
    name: "Freeze Challenge",
    shortName: "Freeze",
    description: "Challenge a player to solve a hard problem or lose XP.",
  },
  shield: {
    name: "Trap Shield",
    shortName: "Shield",
    description: "Blocks one XP trap while roaming.",
  },
  surge: {
    name: "XP Surge",
    shortName: "Surge",
    description: "Future boost for random XP gains.",
  },
  warp: {
    name: "Warp Key",
    shortName: "Warp",
    description: "Future fast-travel key for deep hunt zones.",
  },
};

const SHOP_POWER_UPS = [
  { id: "freeze", cost: 180 },
  { id: "shield", cost: 90 },
  { id: "surge", cost: 120 },
  { id: "warp", cost: 160 },
];

const CHARACTERS = [
  { id: "nova", name: "Nova", cost: 0, perk: "Starter scout" },
  { id: "cipher", name: "Cipher", cost: 240, perk: "Chest scanner" },
  { id: "onyx", name: "Onyx", cost: 420, perk: "Trap resistance" },
];

const RANDOM_PLAYERS = [
  "runtime rebel",
  "binary monk",
  "heap walker",
  "stack runner",
  "syntax ghost",
];
const INITIAL_INVENTORY = {
  freeze: 0,
  shield: 0,
  surge: 0,
  warp: 0,
};

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

const positionKey = (position) => `${position.x}:${position.y}`;

const hashCoordinate = (x, y, salt = 0) => {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ salt;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
};

const getGeneratedCell = (x, y, openedCells) => {
  const key = `${x}:${y}`;
  const terrain = hashCoordinate(x, y, 9) % 5;

  if ((x === 0 && y === 0) || openedCells.has(key)) {
    return { terrain, encounter: null };
  }

  const roll = hashCoordinate(x, y, 31) % 1000;
  const detailRoll = hashCoordinate(x, y, 53);

  if (roll < 44) {
    return {
      terrain,
      encounter: {
        kind: "chest",
        reward: 20 + (detailRoll % 9) * 10,
      },
    };
  }

  if (roll < 73) {
    const types = Object.keys(POWER_UPS);
    return {
      terrain,
      encounter: {
        kind: "powerup",
        type: types[detailRoll % types.length],
      },
    };
  }

  if (roll < 96) {
    return {
      terrain,
      encounter: {
        kind: "trap",
        penalty: 20 + (detailRoll % 5) * 15,
      },
    };
  }

  return { terrain, encounter: null };
};

export default function PowerUpHunt() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInUser") || "null");
    } catch {
      return null;
    }
  }, []);

  const [player, setPlayer] = useState(START_POSITION);
  const [openedCells, setOpenedCells] = useState(() => new Set());
  const [walletXp, setWalletXp] = useState(Number(currentUser?.xp || 0));
  const [sessionDelta, setSessionDelta] = useState(0);
  const [steps, setSteps] = useState(0);
  const [inventory, setInventory] = useState({ ...INITIAL_INVENTORY });
  const [ownedCharacters, setOwnedCharacters] = useState(() => new Set(["nova"]));
  const [selectedCharacter, setSelectedCharacter] = useState("nova");
  const [lastDirection, setLastDirection] = useState({ x: 1, y: 0 });
  const [eventLog, setEventLog] = useState([
    {
      id: "start",
      tone: "neutral",
      message: "Infinite hunt opened. Move in any direction to find chests.",
    },
  ]);
  const [friends, setFriends] = useState([]);

  const playerRef = useRef(START_POSITION);
  const openedCellsRef = useRef(new Set());
  const inventoryRef = useRef({ ...INITIAL_INVENTORY });

  const addLog = useCallback((message, tone = "neutral") => {
    setEventLog((current) => [
      { id: `${Date.now()}-${Math.random()}`, message, tone },
      ...current,
    ].slice(0, 7));
  }, []);

  const markCellOpened = useCallback((key) => {
    openedCellsRef.current = new Set(openedCellsRef.current).add(key);
    setOpenedCells(new Set(openedCellsRef.current));
  }, []);

  const changeWallet = useCallback((amount) => {
    setWalletXp((current) => Math.max(0, current + amount));
    setSessionDelta((current) => current + amount);
  }, []);

  const triggerEncounter = useCallback(
    (position) => {
      const key = positionKey(position);
      if (openedCellsRef.current.has(key)) return;

      const { encounter } = getGeneratedCell(
        position.x,
        position.y,
        openedCellsRef.current
      );

      if (!encounter) return;

      markCellOpened(key);

      if (encounter.kind === "chest") {
        changeWallet(encounter.reward);
        addLog(`Chest opened: +${encounter.reward} XP`, "gain");
        return;
      }

      if (encounter.kind === "powerup") {
        setInventory((current) => {
          const nextInventory = {
            ...current,
            [encounter.type]: current[encounter.type] + 1,
          };
          inventoryRef.current = nextInventory;
          return nextInventory;
        });
        addLog(`${POWER_UPS[encounter.type].name} collected`, "power");
        return;
      }

      if (encounter.kind === "trap") {
        if (inventoryRef.current.shield > 0) {
          const nextInventory = {
            ...inventoryRef.current,
            shield: inventoryRef.current.shield - 1,
          };
          inventoryRef.current = nextInventory;
          setInventory(nextInventory);
          addLog("Trap blocked by shield", "power");
        } else {
          changeWallet(-encounter.penalty);
          addLog(`Trap triggered: -${encounter.penalty} XP`, "loss");
        }
      }
    },
    [addLog, changeWallet, markCellOpened]
  );

  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  const movePlayer = useCallback(
    (direction, distance = 1) => {
      setLastDirection(direction);

      let next = playerRef.current;
      for (let index = 0; index < distance; index += 1) {
        next = {
          x: next.x + direction.x,
          y: next.y + direction.y,
        };
      }

      playerRef.current = next;
      setPlayer(next);
      setSteps((current) => current + distance);
      triggerEncounter(next);
    },
    [triggerEncounter]
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
        movePlayer(lastDirection, 3);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lastDirection, movePlayer]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    let mounted = true;

    const loadFriends = async () => {
      const [
        { data: relations, error: relationError },
        { data: users, error: userError },
      ] = await Promise.all([
        supabase.from("friends").select("*"),
        supabase.from("lusers").select("id, username, uusername, xp"),
      ]);

      if (!mounted || relationError || userError) return;

      const currentUserId = String(currentUser.id);
      const friendIds = new Set(
        (relations || [])
          .filter(
            (relation) =>
              String(relation.user1_id) === currentUserId ||
              String(relation.user2_id) === currentUserId
          )
          .map((relation) =>
            String(
              String(relation.user1_id) === currentUserId
                ? relation.user2_id
                : relation.user1_id
            )
          )
      );

      setFriends((users || []).filter((user) => friendIds.has(String(user.id))));
    };

    loadFriends();

    return () => {
      mounted = false;
    };
  }, [currentUser?.id]);

  const tiles = useMemo(() => {
    const nextTiles = [];

    for (let row = 0; row < VIEW_HEIGHT; row += 1) {
      for (let column = 0; column < VIEW_WIDTH; column += 1) {
        const worldX = player.x + column - CENTER_X;
        const worldY = player.y + row - CENTER_Y;
        nextTiles.push({
          column,
          row,
          worldX,
          worldY,
          key: `${worldX}:${worldY}`,
          ...getGeneratedCell(worldX, worldY, openedCells),
        });
      }
    }

    return nextTiles;
  }, [openedCells, player]);

  const resetGame = () => {
    const emptySet = new Set();
    openedCellsRef.current = emptySet;
    playerRef.current = START_POSITION;
    setOpenedCells(emptySet);
    setPlayer(START_POSITION);
    setWalletXp(Number(currentUser?.xp || 0));
    setSessionDelta(0);
    setSteps(0);
    inventoryRef.current = { ...INITIAL_INVENTORY };
    setInventory({ ...INITIAL_INVENTORY });
    setOwnedCharacters(new Set(["nova"]));
    setSelectedCharacter("nova");
    setLastDirection({ x: 1, y: 0 });
    setEventLog([
      {
        id: "start",
        tone: "neutral",
        message: "Infinite hunt opened. Move in any direction to find chests.",
      },
    ]);
  };

  const buyPowerUp = (item) => {
    if (walletXp < item.cost) {
      addLog(`Need ${item.cost} XP to buy ${POWER_UPS[item.id].shortName}`, "loss");
      return;
    }

    changeWallet(-item.cost);
    setInventory((current) => {
      const nextInventory = {
        ...current,
        [item.id]: current[item.id] + 1,
      };
      inventoryRef.current = nextInventory;
      return nextInventory;
    });
    addLog(`Bought ${POWER_UPS[item.id].name}`, "power");
  };

  const buyOrEquipCharacter = (character) => {
    if (ownedCharacters.has(character.id)) {
      setSelectedCharacter(character.id);
      addLog(`${character.name} equipped`, "power");
      return;
    }

    if (walletXp < character.cost) {
      addLog(`Need ${character.cost} XP to unlock ${character.name}`, "loss");
      return;
    }

    changeWallet(-character.cost);
    setOwnedCharacters((current) => new Set(current).add(character.id));
    setSelectedCharacter(character.id);
    addLog(`${character.name} unlocked and equipped`, "power");
  };

  const shareXp = (mode) => {
    if (walletXp < SHARE_AMOUNT) {
      addLog(`Need ${SHARE_AMOUNT} XP to share`, "loss");
      return;
    }

    const friendTarget = friends[0];
    const randomTarget =
      RANDOM_PLAYERS[hashCoordinate(player.x, player.y, steps) % RANDOM_PLAYERS.length];
    const target =
      mode === "friend" && friendTarget
        ? friendTarget.uusername || friendTarget.username
        : randomTarget;

    changeWallet(-SHARE_AMOUNT);
    addLog(`Shared ${SHARE_AMOUNT} XP with ${target}`, "power");
  };

  const useFreezeChallenge = () => {
    if (inventory.freeze <= 0) {
      addLog("No Freeze Challenge token available", "loss");
      return;
    }

    setInventory((current) => {
      const nextInventory = { ...current, freeze: current.freeze - 1 };
      inventoryRef.current = nextInventory;
      return nextInventory;
    });
    addLog("Freeze Challenge armed: target must solve a hard problem.", "power");
  };

  const selectedCharacterData =
    CHARACTERS.find((character) => character.id === selectedCharacter) ||
    CHARACTERS[0];

  return (
    <div className="power-hunt-page">
      <header className="power-hunt-header">
        <div>
          <span>XP economy prototype</span>
          <h1>Power Up Hunt</h1>
          <p>
            Roam an infinite forest, open chests, collect abilities, and dodge XP
            traps.
          </p>
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
              <span>Wallet</span>
              <strong>{walletXp} XP</strong>
            </div>
            <div>
              <span>Session</span>
              <strong>{sessionDelta >= 0 ? "+" : ""}{sessionDelta}</strong>
            </div>
            <div>
              <span>Position</span>
              <strong>{player.x}, {player.y}</strong>
            </div>
            <div>
              <span>Steps</span>
              <strong>{steps}</strong>
            </div>
          </div>

          <div
            className="forest-board infinite-board"
            style={{
              "--grid-width": VIEW_WIDTH,
              "--grid-height": VIEW_HEIGHT,
              "--scroll-x": `${player.x * -18}px`,
              "--scroll-y": `${player.y * -18}px`,
            }}
            role="application"
            aria-label="Infinite Power Up Hunt game board"
          >
            {tiles.map((tile) => {
              const hasPlayer = tile.column === CENTER_X && tile.row === CENTER_Y;
              const encounter = tile.encounter;

              return (
                <div
                  className={`forest-tile terrain-${tile.terrain} ${
                    encounter ? `encounter-${encounter.kind}` : ""
                  }`}
                  key={tile.key}
                  title={`${tile.worldX}, ${tile.worldY}`}
                >
                  {encounter?.kind === "chest" && (
                    <span className="pixel-chest" title="XP chest" />
                  )}
                  {encounter?.kind === "trap" && (
                    <span className="pixel-trap" title="XP trap" />
                  )}
                  {encounter?.kind === "powerup" && (
                    <span
                      className={`pixel-power-up ${encounter.type}`}
                      title={POWER_UPS[encounter.type].name}
                    />
                  )}
                  {hasPlayer && (
                    <span
                      className={`pixel-scout skin-${selectedCharacter}`}
                      title={selectedCharacterData.name}
                    >
                      <i />
                      <b />
                      <em />
                    </span>
                  )}
                </div>
              );
            })}
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
              onClick={() => movePlayer(lastDirection, 3)}
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
          <span className="game-eyebrow">Active scout</span>
          <h2>{selectedCharacterData.name}</h2>
          <p>
            XP is the hunt currency. Chest gains, trap losses, shop purchases,
            and sharing are session-only until the backend economy is locked.
          </p>

          <div className="scout-preview">
            <span className={`pixel-scout preview-scout skin-${selectedCharacter}`}>
              <i />
              <b />
              <em />
            </span>
          </div>

          <div className="ability-panel">
            <span>Abilities</span>
            {Object.entries(POWER_UPS).map(([id, item]) => (
              <div key={id}>
                <strong>{item.shortName}</strong>
                <small>{inventory[id]} owned</small>
              </div>
            ))}
            <button type="button" onClick={useFreezeChallenge}>
              Arm Freeze Challenge
            </button>
          </div>

          <div className="shop-panel">
            <span>Power shop</span>
            {SHOP_POWER_UPS.map((item) => (
              <button type="button" key={item.id} onClick={() => buyPowerUp(item)}>
                <strong>{POWER_UPS[item.id].shortName}</strong>
                <small>{item.cost} XP</small>
              </button>
            ))}
          </div>

          <div className="character-shop-panel">
            <span>Characters</span>
            {CHARACTERS.map((character) => {
              const owned = ownedCharacters.has(character.id);
              return (
                <button
                  type="button"
                  className={selectedCharacter === character.id ? "active" : ""}
                  key={character.id}
                  onClick={() => buyOrEquipCharacter(character)}
                >
                  <strong>{character.name}</strong>
                  <small>{owned ? character.perk : `${character.cost} XP`}</small>
                </button>
              );
            })}
          </div>

          <div className="social-xp-panel">
            <span>XP sharing</span>
            <button type="button" onClick={() => shareXp("friend")}>
              Share {SHARE_AMOUNT} XP with friend
            </button>
            <button type="button" onClick={() => shareXp("random")}>
              Share {SHARE_AMOUNT} XP with random player
            </button>
          </div>

          <div className="event-log-panel">
            <span>Hunt log</span>
            {eventLog.map((event) => (
              <p className={event.tone} key={event.id}>
                <Zap size={12} />
                {event.message}
              </p>
            ))}
          </div>

          <div className="game-control-list">
            <span>Controls</span>
            <div><kbd>WASD</kbd><strong>Move</strong></div>
            <div><kbd>Arrows</kbd><strong>Move</strong></div>
            <div><kbd>Z</kbd><strong>Dash 3 tiles</strong></div>
          </div>
        </aside>
      </main>
    </div>
  );
}

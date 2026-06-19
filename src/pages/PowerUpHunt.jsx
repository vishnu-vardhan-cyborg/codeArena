import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  RotateCcw,
  Zap,
} from "lucide-react";
import { supabase } from "../supabase";
import {
  applyHuntReward,
  loadPowerupInventory,
} from "../features/powerups/powerupApi";
import { showAppToast } from "../utils/appToast";
import "../styles/PowerUpHunt.css";

const VIEW_WIDTH = 19;
const VIEW_HEIGHT = 13;
const CENTER_X = Math.floor(VIEW_WIDTH / 2);
const CENTER_Y = Math.floor(VIEW_HEIGHT / 2);
const START_POSITION = { x: 0, y: 0 };
const SHARE_AMOUNT = 25;
const PROBLEM_LOCKED_POWERUPS = new Set(["settle_the_bet", "steal"]);

const POWER_UPS = {
  settle_the_bet: {
    name: "Settle the Bet",
    shortName: "Bet",
    description: "Attack: target must solve a challenge in 24 hours or lose XP.",
  },
  steal: {
    name: "Steal XP",
    shortName: "Steal",
    description: "Attack: steal a small amount of XP from another player.",
  },
  shield: {
    name: "Shield",
    shortName: "Shield",
    description: "Defense: blocks one incoming attack.",
  },
  uno_reverse: {
    name: "Uno Reverse",
    shortName: "Reverse",
    description: "Defense: reverses an incoming attack.",
  },
  streak_recover: {
    name: "Streak Recover",
    shortName: "Recover",
    description: "Extremely rare: recover a lost streak.",
  },
};

const SHOP_POWER_UPS = [
  { id: "settle_the_bet", cost: 220 },
  { id: "steal", cost: 160 },
  { id: "shield", cost: 180 },
  { id: "uno_reverse", cost: 260 },
];

const CHARACTERS = [
  { id: "nova", name: "Nova", cost: 0, perk: "Starter scout" },
  { id: "cipher", name: "Cipher", cost: 240, perk: "Chest scanner" },
  { id: "onyx", name: "Onyx", cost: 420, perk: "Trap resistance" },
];

const INITIAL_INVENTORY = {
  settle_the_bet: 0,
  steal: 0,
  shield: 0,
  uno_reverse: 0,
  streak_recover: 0,
};

const normalizePowerupKey = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized === "settle_bet") return "settle_the_bet";
  if (normalized === "steal_xp" || normalized === "stealxp") return "steal";
  if (normalized === "uno") return "uno_reverse";
  return normalized;
};

const normalizeInventory = (inventory = {}, powerups = []) => {
  const nextInventory = { ...INITIAL_INVENTORY, ...inventory };

  powerups.forEach((powerup) => {
    const rawKey = String(powerup.powerup_name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const key = normalizePowerupKey(powerup.powerup_name);

    if (key !== rawKey || nextInventory[key] === undefined) {
      nextInventory[key] =
        Number(nextInventory[key] || 0) + Number(powerup.quantity || 0);
    }
  });

  return nextInventory;
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
const chestNeedsProblem = (powerupName) => PROBLEM_LOCKED_POWERUPS.has(powerupName);
const wait = (milliseconds) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const hashCoordinate = (x, y, salt = 0) => {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ salt;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
};

const pickPowerupType = (roll) => {
  if (roll % 5000 === 0) return "streak_recover";

  const bucket = roll % 100;
  if (bucket < 36) return "shield";
  if (bucket < 66) return "settle_the_bet";
  if (bucket < 86) return "steal";
  return "uno_reverse";
};

const getGeneratedCell = (x, y, openedCells) => {
  const key = `${x}:${y}`;
  const terrain = hashCoordinate(x, y, 9) % 6;
  const treeRoll = hashCoordinate(x, y, 77) % 100;

  if ((x === 0 && y === 0) || openedCells.has(key)) {
    return { terrain, tree: treeRoll < 42, encounter: null };
  }

  const roll = hashCoordinate(x, y, 31) % 10000;
  const detailRoll = hashCoordinate(x, y, 53);

  if (roll < 200) {
    return {
      terrain,
      tree: false,
      encounter: {
        kind: "xp",
        amount: 1,
      },
    };
  }

  if (roll < 270) {
    return {
      terrain,
      tree: false,
      encounter: {
        kind: "xp",
        amount: 2,
      },
    };
  }

  if (roll < 285) {
    return {
      terrain,
      tree: false,
      encounter: {
        kind: "xp",
        amount: 5,
      },
    };
  }

  if (roll < 310) {
    return {
      terrain,
      tree: false,
      encounter: {
        kind: "chest",
        powerupType: pickPowerupType(detailRoll),
      },
    };
  }

  if (roll < 318) {
    return {
      terrain,
      tree: false,
      encounter: {
        kind: "powerup",
        type: pickPowerupType(detailRoll),
      },
    };
  }

  if (roll < 363) {
    return {
      terrain,
      tree: false,
      encounter: {
        kind: "trap",
        penalty: [1, 2, 3][detailRoll % 3],
      },
    };
  }

  return { terrain, tree: treeRoll < 48, encounter: null };
};

export default function PowerUpHunt() {
  const navigate = useNavigate();
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
      message: "Infinite hunt opened. Search for XP, hidden chests, traps, and rare powerups.",
    },
  ]);
  const [friends, setFriends] = useState([]);
  const [lockedChest, setLockedChest] = useState(null);
  const [chestLoading, setChestLoading] = useState(false);
  const [chestAnimationStage, setChestAnimationStage] = useState("");
  const [revealedPowerup, setRevealedPowerup] = useState("");
  const [rewardBusy, setRewardBusy] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);

  const playerRef = useRef(START_POSITION);
  const openedCellsRef = useRef(new Set());
  const inventoryRef = useRef({ ...INITIAL_INVENTORY });
  const lockedChestRef = useRef(null);
  const unlockingChestRef = useRef(false);
  const lockedChestKey = currentUser?.id
    ? `codeArenaLockedChest:${currentUser.id}`
    : "";
  const chestRewardKey = currentUser?.id
    ? `codeArenaChestReward:${currentUser.id}`
    : "";

  const persistLockedChest = useCallback(
    (chest) => {
      setLockedChest(chest);

      if (!lockedChestKey) return;

      if (chest) {
        localStorage.setItem(lockedChestKey, JSON.stringify(chest));
      } else {
        localStorage.removeItem(lockedChestKey);
      }
    },
    [lockedChestKey]
  );

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

  const syncCurrentUserXp = useCallback(
    (totalXp) => {
      if (!currentUser || totalXp === null || totalXp === undefined) return;

      const nextUser = { ...currentUser, xp: totalXp };
      localStorage.setItem("loggedInUser", JSON.stringify(nextUser));
      setWalletXp(Number(totalXp || 0));
    },
    [currentUser]
  );

  const applyServerHuntReward = useCallback(
    async ({ rewardKind, amount = 0, powerupName = null, metadata = {} }) => {
      if (!currentUser?.id) {
        changeWallet(amount);
        return null;
      }

      setRewardBusy(true);

      try {
        const result = await applyHuntReward({
          userId: currentUser.id,
          rewardKind,
          amount,
          powerupName,
          metadata,
        });

        if (result.totalXp !== null && result.totalXp !== undefined) {
          syncCurrentUserXp(result.totalXp);
          setSessionDelta((current) => current + amount);
        }

        if (result.inventory) {
          inventoryRef.current = { ...INITIAL_INVENTORY, ...result.inventory };
          setInventory(inventoryRef.current);
        }

        return result;
      } catch (error) {
        addLog(error.message, "loss");
        return null;
      } finally {
        setRewardBusy(false);
      }
    },
    [addLog, changeWallet, currentUser?.id, syncCurrentUserXp]
  );

  const selectChestProblem = useCallback(
    async (position) => {
      const { data: problemRows, error: problemError } = await supabase
        .from("problems")
        .select("id")
        .limit(120);

      if (problemError || !problemRows?.length) {
        addLog("No problem catalog available for this chest.", "loss");
        showAppToast("No problem catalog available for this chest.", "error");
        return "";
      }

      const problemIds = problemRows.map((problem) => problem.id).filter(Boolean);
      let solvedProblemIds = new Set();

      if (currentUser?.id && problemIds.length > 0) {
        const { data: solvedRows } = await supabase
          .from("user_problem_progress")
          .select("problem_id")
          .eq("user_id", String(currentUser.id))
          .in("problem_id", problemIds)
          .not("solved_at", "is", null);

        solvedProblemIds = new Set(
          (solvedRows || []).map((row) => String(row.problem_id))
        );
      }

      const unsolvedProblemIds = problemIds.filter(
        (problemId) => !solvedProblemIds.has(String(problemId))
      );
      const candidateIds = unsolvedProblemIds.length
        ? unsolvedProblemIds
        : problemIds;

      return candidateIds[
        hashCoordinate(position.x, position.y, steps + 701) % candidateIds.length
      ];
    },
    [addLog, currentUser?.id, steps]
  );

  const triggerEncounter = useCallback(
    async (position) => {
      const key = positionKey(position);
      if (openedCellsRef.current.has(key)) return;

      const { encounter } = getGeneratedCell(
        position.x,
        position.y,
        openedCellsRef.current
      );

      if (!encounter) return;

      markCellOpened(key);

      if (encounter.kind === "xp") {
        applyServerHuntReward({
          rewardKind: "xp",
          amount: encounter.amount,
          metadata: { position },
        });
        addLog(`Floating XP collected: +${encounter.amount} XP`, "gain");
        return;
      }

      if (encounter.kind === "chest") {
        if (lockedChestRef.current) {
          showAppToast("Chest found!", "success", "Chest found");
          addLog(
            "Another chest appeared. Open the current locked chest first.",
            "power"
          );
          return;
        }

        const chest = {
          powerupType: encounter.powerupType,
          position,
          createdAt: new Date().toISOString(),
          problemId: null,
          status: "found",
        };

        persistLockedChest(chest);
        showAppToast("Chest found!", "success", "Chest found");
        addLog("Chest found. Open it from the side panel.", "power");
        return;
      }

      if (encounter.kind === "powerup") {
        applyServerHuntReward({
          rewardKind: "powerup",
          powerupName: encounter.type,
          metadata: { position },
        });
        addLog(`${POWER_UPS[encounter.type].name} collected`, "power");
        return;
      }

      if (encounter.kind === "trap") {
        applyServerHuntReward({
          rewardKind: "trap",
          amount: -encounter.penalty,
          metadata: { position },
        });
        addLog(`Trap triggered: -${encounter.penalty} XP`, "loss");
      }
    },
    [
      addLog,
      applyServerHuntReward,
      markCellOpened,
      persistLockedChest,
    ]
  );

  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  useEffect(() => {
    lockedChestRef.current = lockedChest;
  }, [lockedChest]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    let mounted = true;

    loadPowerupInventory(currentUser.id)
      .then((result) => {
        if (!mounted) return;
        const nextInventory = normalizeInventory(
          result.inventory || {},
          result.powerups || []
        );
        inventoryRef.current = nextInventory;
        setInventory(nextInventory);
      })
      .catch((error) => addLog(error.message, "loss"));

    return () => {
      mounted = false;
    };
  }, [addLog, currentUser?.id]);

  useEffect(() => {
    if (!lockedChestKey) return;

    try {
      const storedChest = JSON.parse(localStorage.getItem(lockedChestKey) || "null");
      if (storedChest?.problemId || storedChest?.powerupType) {
        const normalizedChest = {
          ...storedChest,
          powerupType:
            storedChest.powerupType ||
            pickPowerupType(
              hashCoordinate(
                storedChest.position?.x || 0,
                storedChest.position?.y || 0,
                97
              )
            ),
        };
        setLockedChest(normalizedChest);
        localStorage.setItem(lockedChestKey, JSON.stringify(normalizedChest));
      } else if (storedChest) {
        localStorage.removeItem(lockedChestKey);
      }
    } catch {
      localStorage.removeItem(lockedChestKey);
    }
  }, [lockedChestKey]);

  useEffect(() => {
    if (!chestRewardKey) return;

    try {
      const reward = JSON.parse(localStorage.getItem(chestRewardKey) || "null");
      if (!reward?.powerupName) return;

      const powerupLabel =
        reward.label || POWER_UPS[reward.powerupName]?.name || "Powerup";
      showAppToast(
        `${powerupLabel} added to inventory!`,
        "success",
        "Powerup added"
      );
      addLog(`${powerupLabel} added to inventory`, "power");
      localStorage.removeItem(chestRewardKey);
    } catch {
      localStorage.removeItem(chestRewardKey);
    }
  }, [addLog, chestRewardKey]);

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

  const resetPosition = () => {
    playerRef.current = START_POSITION;
    setPlayer(START_POSITION);
    setLastDirection({ x: 1, y: 0 });
    addLog("Position reset to 0, 0.", "neutral");
  };

  const buyPowerUp = async (item) => {
    if (walletXp < item.cost) {
      addLog(`Need ${item.cost} XP to buy ${POWER_UPS[item.id].shortName}`, "loss");
      return;
    }

    const result = await applyServerHuntReward({
      rewardKind: "purchase",
      amount: -item.cost,
      powerupName: item.id,
      metadata: { source: "shop" },
    });

    if (result) {
      addLog(`Bought ${POWER_UPS[item.id].name}`, "power");
    }
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

  const shareXp = () => {
    if (walletXp < SHARE_AMOUNT) {
      addLog(`Need ${SHARE_AMOUNT} XP to share`, "loss");
      return;
    }

    const friendTarget = friends[0];
    const target = friendTarget
      ? friendTarget.uusername || friendTarget.username
      : "a friend";

    changeWallet(-SHARE_AMOUNT);
    addLog(`Shared ${SHARE_AMOUNT} XP with ${target}`, "power");
  };

  const runChestUnlockSequence = useCallback(
    async (powerupName, options = {}) => {
      if (!powerupName || unlockingChestRef.current) return false;

      const powerupLabel = POWER_UPS[powerupName]?.name || "Powerup";
      unlockingChestRef.current = true;
      setRevealedPowerup("");

      try {
        if (options.fromProblem) {
          showAppToast("Correct answer!", "success", "Correct answer");
          setChestAnimationStage("correct");
          await wait(650);
          showAppToast("Key found!", "success", "Key found");
          addLog("Key found!", "power");
          setChestAnimationStage("key");
          await wait(750);
          setChestAnimationStage("move");
          await wait(900);
        }

        setChestAnimationStage("open");
        await wait(650);

        const result = await applyServerHuntReward({
          rewardKind: "powerup",
          powerupName,
          metadata: {
            source: "chest",
            problemId: lockedChest?.problemId || null,
            position: lockedChest?.position || null,
            unlockedByProblem: Boolean(options.fromProblem),
          },
        });

        if (!result) {
          setChestAnimationStage("");
          showAppToast(
            "Powerup could not be added. Please try again.",
            "error"
          );
          return false;
        }

        setRevealedPowerup(powerupName);
        setChestAnimationStage("reveal");
        await wait(800);
        addLog(`${powerupLabel} added to inventory`, "power");
        showAppToast(
          `${powerupLabel} added to inventory!`,
          "success",
          "Powerup added"
        );
        setChestAnimationStage("complete");
        await wait(500);
        setChestAnimationStage("");
        setRevealedPowerup("");
        persistLockedChest(null);
        return true;
      } finally {
        unlockingChestRef.current = false;
      }
    },
    [
      addLog,
      applyServerHuntReward,
      lockedChest?.position,
      lockedChest?.problemId,
      persistLockedChest,
    ]
  );

  const loadChestChallenge = useCallback(async () => {
    if (!lockedChest || !currentUser?.id) return;
    if (!chestNeedsProblem(lockedChest.powerupType)) return;

    setChestLoading(true);

    try {
      const problemId =
        lockedChest.problemId || (await selectChestProblem(lockedChest.position));

      if (!problemId) {
        showAppToast("No challenge problem is available right now.", "error");
        return;
      }

      const nextChest = {
        ...lockedChest,
        problemId,
        status: "challenge",
      };
      persistLockedChest(nextChest);
      navigate(`/problems/${problemId}`);
    } catch (error) {
      showAppToast(error.message, "error");
    } finally {
      setChestLoading(false);
    }
  }, [
    currentUser?.id,
    lockedChest,
    navigate,
    persistLockedChest,
    selectChestProblem,
  ]);

  const handleOpenChest = useCallback(async () => {
    if (!lockedChest || rewardBusy || chestLoading || chestAnimationStage) {
      return;
    }

    if (chestNeedsProblem(lockedChest.powerupType)) {
      await loadChestChallenge();
      return;
    }

    await runChestUnlockSequence(lockedChest.powerupType);
  }, [
    chestAnimationStage,
    chestLoading,
    loadChestChallenge,
    lockedChest,
    rewardBusy,
    runChestUnlockSequence,
  ]);

  useEffect(() => {
    if (
      lockedChest &&
      !chestNeedsProblem(lockedChest.powerupType) &&
      !chestAnimationStage &&
      !unlockingChestRef.current
    ) {
      runChestUnlockSequence(lockedChest.powerupType);
    }
  }, [chestAnimationStage, lockedChest, runChestUnlockSequence]);

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
            Roam a dense forest, collect floating XP, unlock hidden chests with
            solved problems, find rare powerups, and dodge XP traps.
          </p>
        </div>
        <div className="power-hunt-actions">
          <button
            type="button"
            className="power-shop-icon-button"
            onClick={() => setIsShopOpen(true)}
            aria-label="Open shop"
          >
            <ShoppingBag size={18} />
            Shop
          </button>
          <button type="button" onClick={resetPosition}>
            <RotateCcw size={18} />
            Reset position
          </button>
        </div>
      </header>

      <main className="power-hunt-layout">
        <section className="power-game-panel">
          <div className="power-game-hud">
            <div aria-label="Wallet XP" title="Wallet XP">
              <strong>{walletXp} XP</strong>
            </div>
            <div aria-label="Session XP change" title="Session XP change">
              <strong>{sessionDelta >= 0 ? "+" : ""}{sessionDelta}</strong>
            </div>
            <div aria-label="Current position" title="Current position">
              <strong>{player.x}, {player.y}</strong>
            </div>
            <div aria-label="Steps moved" title="Steps moved">
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
              const visibleEncounter =
                encounter?.kind === "trap" || encounter?.kind === "chest"
                  ? null
                  : encounter;

              return (
                <div
                  className={`forest-tile terrain-${tile.terrain} ${
                    visibleEncounter ? `encounter-${visibleEncounter.kind}` : ""
                  }`}
                  key={tile.key}
                  title={`${tile.worldX}, ${tile.worldY}`}
                >
                  {encounter?.kind === "xp" && (
                    <span className={`floating-xp xp-${encounter.amount}`}>
                      +{encounter.amount}
                    </span>
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
                  {!hasPlayer && !encounter && tile.tree && (
                    <span className="pixel-tree" title="Forest tree" />
                  )}
                </div>
              );
            })}
          </div>

        </section>

        <aside className="power-game-sidebar">
          <span className="game-eyebrow">Active scout</span>
          <h2>{selectedCharacterData.name}</h2>
          <p>
            XP is the hunt currency. Forest gains, traps, chests, and powerup
            purchases are validated by the backend economy.
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
          </div>

          {lockedChest && (
            <div className="locked-chest-panel">
              <span>Locked chest</span>
              <strong>
                {POWER_UPS[lockedChest.powerupType]?.name || "Powerup"} sealed
              </strong>
              <small>
                {chestNeedsProblem(lockedChest.powerupType)
                  ? "Load the challenge problem to unlock this chest."
                  : "Open it to reveal the powerup immediately."}
              </small>

              <div
                className={`chest-unlock-animation ${
                  chestAnimationStage ? `stage-${chestAnimationStage}` : ""
                }`}
                aria-label="Chest unlock animation"
              >
                <span className="chest-animation-key" />
                <span className="chest-animation-chest" />
                {(revealedPowerup || chestAnimationStage === "complete") && (
                  <span
                    className={`pixel-power-up chest-reveal-power ${
                      revealedPowerup || lockedChest.powerupType
                    }`}
                    title={
                      POWER_UPS[revealedPowerup || lockedChest.powerupType]?.name
                    }
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenChest}
                disabled={
                  rewardBusy ||
                  chestLoading ||
                  Boolean(chestAnimationStage)
                }
              >
                {chestNeedsProblem(lockedChest.powerupType)
                  ? chestLoading
                    ? "Loading..."
                    : "Load challenge"
                  : "Open chest"}
              </button>
            </div>
          )}

          <div className="social-xp-panel">
            <span>XP sharing</span>
            <button type="button" onClick={shareXp}>
              Share {SHARE_AMOUNT} XP with friend
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

        </aside>
      </main>

      {isShopOpen && (
        <div className="power-shop-modal-backdrop" role="presentation">
          <div className="power-shop-modal" role="dialog" aria-modal="true">
            <div className="power-shop-modal-header">
              <div>
                <span>XP market</span>
                <h2>Shop</h2>
                <p>Buy powerups or unlock playable scouts with XP.</p>
              </div>
              <button
                type="button"
                className="power-shop-close"
                onClick={() => setIsShopOpen(false)}
                aria-label="Close shop"
              >
                ×
              </button>
            </div>

            <div className="power-shop-wallet">
              <span>Wallet</span>
              <strong>{walletXp} XP</strong>
            </div>

            <div className="power-shop-grid">
              <div className="shop-panel">
                <span>Powerups</span>
                {SHOP_POWER_UPS.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => buyPowerUp(item)}
                    disabled={rewardBusy}
                  >
                    <strong>{POWER_UPS[item.id].shortName}</strong>
                    <small>{item.cost} XP · {inventory[item.id]} owned</small>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

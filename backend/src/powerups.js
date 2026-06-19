const { hasServiceRole, supabase } = require("./supabase");

const ATTACK_POWERUPS = ["settle_the_bet", "steal"];
const DEFENSE_POWERUPS = ["shield", "uno_reverse"];
const ALL_POWERUPS = [
  "settle_the_bet",
  "steal",
  "shield",
  "uno_reverse",
  "streak_recover",
];
const VALID_XP_REWARDS = new Set([1, 2, 5, 10, 12, 18, 25]);
const VALID_XP_TRAPS = new Set([-1, -2, -3, -4, -8, -12]);
const VALID_PURCHASE_COSTS = new Set([-160, -180, -220, -260]);
const SETTLE_XP_PENALTY = 20;
const STEAL_AMOUNT = 50;
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const SHIELD_DURATION_MS = 24 * 60 * 60 * 1000;

const POWERUP_LABELS = {
  settle_the_bet: "Settle the Bet",
  steal: "Steal",
  shield: "Shield",
  uno_reverse: "Uno Reverse",
  streak_recover: "Streak Recover",
};

const tableMissingCodes = new Set(["42P01", "PGRST205"]);

const normalizeId = (value) => String(value || "").trim();

const normalizePowerupName = (value) => {
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

const displayPowerupName = (value) =>
  POWERUP_LABELS[normalizePowerupName(value)] || String(value || "Powerup");

const isMissingColumnError = (error) =>
  Boolean(
    error &&
      (error.code === "42703" ||
        String(error.message || "").toLowerCase().includes("problem_id"))
  );

const getProblemChallengeText = (problemId, fallbackText) => {
  const normalizedProblemId = String(problemId || "").trim();
  if (normalizedProblemId) return `problem:${normalizedProblemId}`;
  return fallbackText || "Solve one coding challenge within 24 hours.";
};

const parseProblemIdFromChallenge = (challengeText = "") => {
  const text = String(challengeText || "").trim();
  return text.startsWith("problem:") ? text.slice("problem:".length).trim() : "";
};

const isFutureDate = (value) =>
  Boolean(value && new Date(value).getTime() > Date.now());

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isMissingTableError = (error) =>
  Boolean(error && tableMissingCodes.has(error.code));

const requirePowerupTables = (error) => {
  if (isMissingTableError(error)) {
    throw createHttpError(
      "Powerup tables are missing. Run backend/schemas/powerup-schema.sql in Supabase.",
      503
    );
  }

  throw error;
};

const assertAdminClient = () => {
  if (!hasServiceRole) {
    throw createHttpError(
      "Backend XP updates require SUPABASE_SECRET_KEY on the socket server.",
      503
    );
  }
};

const mapInventoryRows = (rows = []) =>
  ALL_POWERUPS.reduce((inventory, name) => {
    const row = rows.find((item) => normalizePowerupName(item.powerup_name) === name);
    inventory[name] = Number(row?.quantity || 0);
    return inventory;
  }, {});

const getUserPowerups = async (userId) => {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) {
    throw createHttpError("Missing user id.");
  }

  const { data, error } = await supabase
    .from("powerups")
    .select("user_id, powerup_name, quantity, expires_at, created_at")
    .eq("user_id", normalizedUserId);

  if (error) requirePowerupTables(error);

  return {
    powerups: data || [],
    inventory: mapInventoryRows(data || []),
    activeShieldExpiresAt:
      (data || []).find(
        (item) =>
          normalizePowerupName(item.powerup_name) === "shield" &&
          isFutureDate(item.expires_at)
      )?.expires_at || null,
  };
};

const activateShield = async (payload = {}) => {
  const userId = normalizeId(payload.userId);
  if (!userId) throw createHttpError("Missing user id.");

  const { powerups } = await getUserPowerups(userId);
  const shieldRow = powerups.find(
    (item) => normalizePowerupName(item.powerup_name) === "shield"
  );

  if (isFutureDate(shieldRow?.expires_at)) {
    return {
      message: "Shield is already active.",
      activeShieldExpiresAt: shieldRow.expires_at,
      inventory: (await getUserPowerups(userId)).inventory,
    };
  }

  if (Number(shieldRow?.quantity || 0) <= 0) {
    throw createHttpError("You do not have a Shield powerup.");
  }

  const expiresAt = new Date(Date.now() + SHIELD_DURATION_MS).toISOString();
  await upsertPowerupQuantity(userId, "shield", -1, expiresAt);
  const nextState = await getUserPowerups(userId);

  return {
    message: "Shield activated for 24 hours.",
    activeShieldExpiresAt: expiresAt,
    inventory: nextState.inventory,
  };
};

const upsertPowerupQuantity = async (userId, powerupName, delta, expiresAt) => {
  const normalizedUserId = normalizeId(userId);
  const normalizedPowerup = normalizePowerupName(powerupName);

  if (!ALL_POWERUPS.includes(normalizedPowerup)) {
    throw createHttpError("Unknown powerup.");
  }

  const { data: currentRows, error: readError } = await supabase
    .from("powerups")
    .select("user_id, powerup_name, quantity, expires_at")
    .eq("user_id", normalizedUserId)
    .eq("powerup_name", normalizedPowerup)
    .limit(1);

  if (readError) requirePowerupTables(readError);

  const currentQuantity = Number(currentRows?.[0]?.quantity || 0);
  const nextQuantity = Math.max(0, currentQuantity + Number(delta || 0));
  const nextExpiresAt =
    expiresAt === undefined ? currentRows?.[0]?.expires_at || null : expiresAt;

  const { error } = await supabase.from("powerups").upsert(
    {
      user_id: normalizedUserId,
      powerup_name: normalizedPowerup,
      quantity: nextQuantity,
      expires_at: nextExpiresAt,
    },
    { onConflict: "user_id,powerup_name" }
  );

  if (error) requirePowerupTables(error);
  return nextQuantity;
};

const consumePowerup = async (userId, powerupName) => {
  const { powerups } = await getUserPowerups(userId);
  const normalizedPowerup = normalizePowerupName(powerupName);
  const row = powerups.find(
    (item) => normalizePowerupName(item.powerup_name) === normalizedPowerup
  );

  if (!row || Number(row.quantity || 0) <= 0) {
    return false;
  }

  await upsertPowerupQuantity(userId, normalizedPowerup, -1, row.expires_at);
  return true;
};

const adjustUserXp = async (userId, amount, options = {}) => {
  assertAdminClient();

  const normalizedUserId = normalizeId(userId);
  const delta = Number(amount || 0);

  const { data: user, error: readError } = await supabase
    .from("lusers")
    .select("id, xp")
    .eq("id", normalizedUserId)
    .single();

  if (readError) throw readError;

  const currentXp = Number(user.xp || 0);

  if (options.rejectInsufficient && currentXp + delta < 0) {
    throw createHttpError("Not enough XP.");
  }

  const nextXp = Math.max(0, currentXp + delta);
  const { error: updateError } = await supabase
    .from("lusers")
    .update({ xp: nextXp })
    .eq("id", normalizedUserId);

  if (updateError) throw updateError;
  return nextXp;
};

const readUserXp = async (userId) => {
  assertAdminClient();

  const normalizedUserId = normalizeId(userId);
  const { data: user, error } = await supabase
    .from("lusers")
    .select("id, xp")
    .eq("id", normalizedUserId)
    .single();

  if (error) throw error;
  return Number(user.xp || 0);
};

const transferUserXp = async ({ fromUserId, toUserId, requestedAmount }) => {
  const fromXpBefore = await readUserXp(fromUserId);
  const amount = Math.min(
    Math.max(0, fromXpBefore),
    Math.max(0, Number(requestedAmount || 0))
  );

  if (amount <= 0) {
    return {
      amount: 0,
      fromXp: fromXpBefore,
      toXp: await readUserXp(toUserId),
    };
  }

  const fromXp = await adjustUserXp(fromUserId, -amount);
  const toXp = await adjustUserXp(toUserId, amount);

  return { amount, fromXp, toXp };
};

const insertAttackNotification = async ({
  recipientId,
  actorId,
  attackId = null,
  capsuleId = null,
  message,
  metadata = {},
}) => {
  const notification = {
    recipient_id: normalizeId(recipientId),
    actor_id: normalizeId(actorId),
    attack_id: attackId,
    capsule_id: capsuleId,
    message,
    metadata,
  };

  const { data, error } = await supabase
    .from("attack_notifications")
    .insert(notification)
    .select("id, created_at")
    .single();
  if (error && !isMissingTableError(error)) throw error;

  const socialResult = await supabase.from("social_notifications").insert({
    recipient_id: notification.recipient_id,
    actor_id: notification.actor_id,
    notification_type: "attack",
    metadata: {
      ...metadata,
      attackId,
      capsuleId,
      message,
    },
  });

  if (socialResult.error && !isMissingTableError(socialResult.error)) {
    // Older social notification constraints may not include attack yet.
  }

  return {
    id: data?.id,
    recipientId: notification.recipient_id,
    actorId: notification.actor_id,
    message,
    metadata,
    createdAt: data?.created_at || new Date().toISOString(),
  };
};

const createAttackRow = async ({
  attackerId,
  targetId,
  capsuleId,
  powerupName,
  challengeText,
  problemId = null,
  status,
  expiresAt = null,
}) => {
  const insertPayload = {
    attacker_id: normalizeId(attackerId),
    target_id: normalizeId(targetId),
    capsule_id: capsuleId || null,
    powerup_name: normalizePowerupName(powerupName),
    challenge_text: challengeText || getProblemChallengeText(problemId),
    problem_id: problemId || null,
    status,
    expires_at: expiresAt,
  };

  let { data, error } = await supabase
    .from("attacks")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error && isMissingColumnError(error)) {
    const { problem_id: _problemId, ...fallbackPayload } = insertPayload;
    const fallbackResult = await supabase
      .from("attacks")
      .insert(fallbackPayload)
      .select("id")
      .single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) requirePowerupTables(error);
  return data.id;
};

const selectAttacks = async (queryBuilder) => {
  let result = await queryBuilder(
    "id, attacker_id, target_id, capsule_id, powerup_name, challenge_text, problem_id, status, created_at, expires_at"
  );

  if (result.error && isMissingColumnError(result.error)) {
    result = await queryBuilder(
      "id, attacker_id, target_id, capsule_id, powerup_name, challenge_text, status, created_at, expires_at"
    );
  }

  return result;
};

const normalizeAttack = (attack) => ({
  id: attack.id,
  attackerId: normalizeId(attack.attacker_id),
  targetId: normalizeId(attack.target_id),
  capsuleId: attack.capsule_id,
  powerupName: normalizePowerupName(attack.powerup_name),
  powerupLabel: displayPowerupName(attack.powerup_name),
  challengeText: attack.challenge_text,
  problemId: attack.problem_id || parseProblemIdFromChallenge(attack.challenge_text),
  status: attack.status,
  createdAt: attack.created_at,
  expiresAt: attack.expires_at,
});

const expirePendingAttacks = async () => {
  const now = new Date().toISOString();
  const { data: attacks, error } = await selectAttacks((columns) =>
    supabase
      .from("attacks")
      .select(columns)
      .eq("status", "pending")
      .lte("expires_at", now)
  );

  if (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }

  for (const attack of attacks || []) {
    const normalizedAttack = normalizeAttack(attack);
    let solved = false;

    let progressQuery = supabase
      .from("user_problem_progress")
      .select("problem_id, solved_at")
      .eq("user_id", normalizedAttack.targetId)
      .gte("solved_at", normalizedAttack.createdAt)
      .lte("solved_at", normalizedAttack.expiresAt);

    if (normalizedAttack.problemId) {
      progressQuery = progressQuery.eq("problem_id", normalizedAttack.problemId);
    }

    const { data: progress } = await progressQuery.limit(1);

    solved = Boolean(progress?.length);

    await supabase
      .from("attacks")
      .update({ status: solved ? "completed" : "failed", resolved_at: now })
      .eq("id", normalizedAttack.id);

    if (!solved) {
      await adjustUserXp(normalizedAttack.targetId, -SETTLE_XP_PENALTY);
      await insertAttackNotification({
        recipientId: normalizedAttack.targetId,
        actorId: normalizedAttack.attackerId,
        attackId: normalizedAttack.id,
        capsuleId: normalizedAttack.capsuleId,
        message: "Settle the Bet expired. XP was lost.",
        metadata: {
          powerupName: "Settle the Bet",
          problemId: normalizedAttack.problemId,
          xpLost: SETTLE_XP_PENALTY,
        },
      });
    }
  }
};

const getPendingAttacks = async ({ userId, capsuleId } = {}) => {
  await expirePendingAttacks();

  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) throw createHttpError("Missing user id.");

  const { data, error } = await selectAttacks((columns) => {
    let query = supabase
      .from("attacks")
      .select(columns)
      .eq("target_id", normalizedUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (capsuleId) {
      query = query.eq("capsule_id", capsuleId);
    }

    return query;
  });

  if (error) {
    if (isMissingTableError(error)) return { attacks: [] };
    throw error;
  }

  return {
    attacks: (data || []).map(normalizeAttack),
  };
};

const completeAttackDefense = async (payload = {}) => {
  const userId = normalizeId(payload.userId);
  const attackId = String(payload.attackId || "").trim();
  const solvedProblemId = String(payload.problemId || "").trim();

  if (!userId || !attackId || !solvedProblemId) {
    throw createHttpError("Missing defense details.");
  }

  const { data, error } = await selectAttacks((columns) =>
    supabase.from("attacks").select(columns).eq("id", attackId).limit(1)
  );

  if (error) requirePowerupTables(error);

  const attack = normalizeAttack(data?.[0] || {});
  if (!attack.id || attack.targetId !== userId || attack.status !== "pending") {
    throw createHttpError("No pending attack found.");
  }

  if (attack.problemId && attack.problemId !== solvedProblemId) {
    throw createHttpError("This solution does not match the attack challenge.");
  }

  const resolvedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("attacks")
    .update({ status: "completed", resolved_at: resolvedAt })
    .eq("id", attack.id);

  if (updateError) requirePowerupTables(updateError);

  await insertAttackNotification({
    recipientId: attack.attackerId,
    actorId: userId,
    attackId: attack.id,
    capsuleId: attack.capsuleId,
    message: "completed your attack challenge.",
    metadata: {
      powerupName: attack.powerupLabel,
      problemId: solvedProblemId,
      attackId: attack.id,
    },
  });

  return {
    ok: true,
    message: "Defense completed. Attack cleared.",
    attackId: attack.id,
  };
};

const performAttack = async (payload = {}) => {
  await expirePendingAttacks();

  const attackerId = normalizeId(payload.attackerId);
  const targetId = normalizeId(payload.targetId);
  const capsuleId = payload.capsuleId || null;

  if (!attackerId || !targetId || attackerId === targetId) {
    throw createHttpError("Choose another player to attack.");
  }

  const { inventory } = await getUserPowerups(attackerId);
  const availableAttack = ATTACK_POWERUPS.find(
    (name) => Number(inventory[name] || 0) > 0
  );

  if (!availableAttack) {
    throw createHttpError("You do not have any attack powerups.");
  }

  const requestedPowerup = normalizePowerupName(payload.powerupName);
  const selectedPowerup =
    ATTACK_POWERUPS.includes(requestedPowerup) &&
    Number(inventory[requestedPowerup] || 0) > 0
      ? requestedPowerup
      : availableAttack;
  const selectedLabel = displayPowerupName(selectedPowerup);
  const notifications = [];

  await consumePowerup(attackerId, selectedPowerup);

  const targetPowerupState = await getUserPowerups(targetId);
  const { inventory: targetInventory } = targetPowerupState;
  if (isFutureDate(targetPowerupState.activeShieldExpiresAt)) {
    const attackId = await createAttackRow({
      attackerId,
      targetId,
      capsuleId,
      powerupName: selectedPowerup,
      challengeText: "Shield blocked the attack.",
      status: "blocked",
    });

    notifications.push(
      await insertAttackNotification({
        recipientId: targetId,
        actorId: attackerId,
        attackId,
        capsuleId,
        message: "Your shield blocked an attack.",
      metadata: { powerupName: "Shield" },
      })
    );

    return {
      status: "blocked",
      message: "Target shield blocked the attack.",
      notifications,
    };
  }

  if (Number(targetInventory.uno_reverse || 0) > 0) {
    await consumePowerup(targetId, "uno_reverse");
    const attackId = await createAttackRow({
      attackerId,
      targetId,
      capsuleId,
      powerupName: selectedPowerup,
      challengeText: "Uno Reverse activated.",
      status: "reversed",
    });

    if (selectedPowerup === "steal") {
      const transfer = await transferUserXp({
        fromUserId: attackerId,
        toUserId: targetId,
        requestedAmount: STEAL_AMOUNT,
      });
      notifications.push(
        await insertAttackNotification({
          recipientId: attackerId,
          actorId: targetId,
          attackId,
          capsuleId,
          message: "Uno Reverse activated.",
          metadata: {
            powerupName: "Uno Reverse",
            xpLost: transfer.amount,
            attackerXp: transfer.fromXp,
            targetXp: transfer.toXp,
          },
        })
      );
    } else {
      notifications.push(
        await insertAttackNotification({
          recipientId: attackerId,
          actorId: targetId,
          attackId,
          capsuleId,
          message: "Uno Reverse activated.",
          metadata: { powerupName: "Uno Reverse" },
        })
      );
    }

    return {
      status: "reversed",
      message: "Uno Reverse activated.",
      notifications,
    };
  }

  if (selectedPowerup === "steal") {
    const attackId = await createAttackRow({
      attackerId,
      targetId,
      capsuleId,
      powerupName: selectedPowerup,
      challengeText: "Someone tried to steal your XP.",
      status: "completed",
    });
    const transfer = await transferUserXp({
      fromUserId: targetId,
      toUserId: attackerId,
      requestedAmount: STEAL_AMOUNT,
    });

    notifications.push(
      await insertAttackNotification({
        recipientId: targetId,
        actorId: attackerId,
        attackId,
        capsuleId,
        message: "Someone tried to steal your XP.",
        metadata: {
          powerupName: selectedLabel,
          xpLost: transfer.amount,
          targetXp: transfer.fromXp,
          attackerXp: transfer.toXp,
        },
      })
    );

    return {
      status: "completed",
      message:
        transfer.amount > 0
          ? `Used ${selectedLabel}. Stole ${transfer.amount} XP.`
          : `Used ${selectedLabel}. Target had no XP to steal.`,
      notifications,
    };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const problemId = String(payload.problemId || "").trim();

  if (selectedPowerup === "settle_the_bet" && !problemId) {
    throw createHttpError("Choose a challenge problem before attacking.");
  }

  const attackId = await createAttackRow({
    attackerId,
    targetId,
    capsuleId,
    powerupName: selectedPowerup,
    challengeText:
      payload.challengeText || getProblemChallengeText(problemId),
    problemId,
    status: "pending",
    expiresAt,
  });

  notifications.push(
    await insertAttackNotification({
      recipientId: targetId,
      actorId: attackerId,
      attackId,
      capsuleId,
      message: `attacked you with ${selectedLabel}.`,
      metadata: { powerupName: selectedLabel, problemId, expiresAt },
    }),
    await insertAttackNotification({
      recipientId: targetId,
      actorId: attackerId,
      attackId,
      capsuleId,
      message: "You must solve this challenge within 24 hours.",
      metadata: { powerupName: selectedLabel, problemId, expiresAt },
    })
  );

  return {
    status: "pending",
    message: `Used ${selectedLabel}. Target has 24 hours to solve.`,
    notifications,
  };
};

const applyHuntReward = async (payload = {}) => {
  const userId = normalizeId(payload.userId);
  const rewardKind = String(payload.rewardKind || "").trim();
  const amount = Number(payload.amount || 0);
  const powerupName = normalizePowerupName(payload.powerupName);

  if (!userId) throw createHttpError("Missing user id.");

  let totalXp = null;
  let grantedPowerup = null;

  if (rewardKind === "xp" || rewardKind === "chest") {
    if (!VALID_XP_REWARDS.has(amount)) {
      throw createHttpError("Invalid XP reward.");
    }

    totalXp = await adjustUserXp(userId, amount);
  } else if (rewardKind === "trap") {
    if (!VALID_XP_TRAPS.has(amount)) {
      throw createHttpError("Invalid trap penalty.");
    }

    totalXp = await adjustUserXp(userId, amount);
  } else if (rewardKind === "powerup") {
    if (!ALL_POWERUPS.includes(powerupName)) {
      throw createHttpError("Invalid powerup reward.");
    }

    await upsertPowerupQuantity(userId, powerupName, 1);
    grantedPowerup = powerupName;
  } else if (rewardKind === "purchase") {
    if (!ALL_POWERUPS.includes(powerupName) || !VALID_PURCHASE_COSTS.has(amount)) {
      throw createHttpError("Invalid powerup purchase.");
    }

    totalXp = await adjustUserXp(userId, amount, { rejectInsufficient: true });
    await upsertPowerupQuantity(userId, powerupName, 1);
    grantedPowerup = powerupName;
  } else {
    throw createHttpError("Invalid hunt reward.");
  }

  const { error } = await supabase.from("forest_rewards").insert({
    user_id: userId,
    reward_kind: rewardKind,
    amount,
    powerup_name: grantedPowerup,
    metadata: payload.metadata || {},
  });

  if (error) requirePowerupTables(error);

  return {
    totalXp,
    grantedPowerup,
    inventory: (await getUserPowerups(userId)).inventory,
  };
};

const runCapsuleMaintenance = async () => {
  const { data: capsules, error } = await supabase
    .from("time_capsules")
    .select("id, status, inactive_since")
    .neq("status", "expired");

  if (error) {
    if (error.code === "42703" || isMissingTableError(error)) {
      return {
        ok: false,
        expired: 0,
        message: "Run backend/schemas/powerup-schema.sql to enable capsule expiry.",
      };
    }

    throw error;
  }

  const capsuleIds = (capsules || []).map((capsule) => capsule.id);
  if (capsuleIds.length === 0) return { ok: true, expired: 0 };

  const { data: members, error: memberError } = await supabase
    .from("time_capsule_members")
    .select("capsule_id, user_id, status")
    .in("capsule_id", capsuleIds);

  if (memberError) throw memberError;

  let expired = 0;
  const now = new Date();

  for (const capsule of capsules || []) {
    const activeMemberCount = (members || []).filter(
      (member) => member.capsule_id === capsule.id && member.status === "joined"
    ).length;

    if (activeMemberCount >= 2) {
      if (capsule.inactive_since) {
        await supabase
          .from("time_capsules")
          .update({ inactive_since: null })
          .eq("id", capsule.id);
      }
      continue;
    }

    if (!capsule.inactive_since) {
      await supabase
        .from("time_capsules")
        .update({ inactive_since: now.toISOString() })
        .eq("id", capsule.id);
      continue;
    }

    if (now.getTime() - new Date(capsule.inactive_since).getTime() >= FOUR_DAYS_MS) {
      await supabase
        .from("time_capsules")
        .update({ status: "expired", expired_at: now.toISOString() })
        .eq("id", capsule.id);
      expired += 1;
    }
  }

  return { ok: true, expired };
};

module.exports = {
  activateShield,
  applyHuntReward,
  completeAttackDefense,
  getPendingAttacks,
  getUserPowerups,
  performAttack,
  runCapsuleMaintenance,
};

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../shared/services/supabase";
import {
  activateShield,
  loadPendingCapsuleAttacks,
  loadPowerupInventory,
  performCapsuleAttack,
  runCapsuleMaintenance,
} from "../../powerups/api/powerupApi";
import { loadProblemPage } from "../../problems/api/problemApi";
import { showAppToast } from "../../../shared/utils/appToast";
import "../../../styles/features/Clan.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRAPH_COLORS = ["#f5c451", "#59d3c6", "#ef6655", "#8fa4ff"];

const getDisplayName = (user) => user?.uusername || user?.username || "Player";

const ATTACK_POWERUP_LABELS = {
  settle_the_bet: "Settle the Bet",
  steal: "Steal XP",
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
  const nextInventory = { ...inventory };

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

const getDaysRemaining = (endsAt) => {
  const milliseconds = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(milliseconds / DAY_MS));
};

const getDateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildRecentDays = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    return {
      key: getDateKey(day),
      label: day.toLocaleDateString([], { weekday: "short" }),
    };
  });
};

export default function TimeCapsuleDetail() {
  const { capsuleId } = useParams();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const currentUserId = currentUser?.id ? String(currentUser.id) : "";

  const [capsule, setCapsule] = useState(null);
  const [members, setMembers] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [activityRows, setActivityRows] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [discussionUnavailable, setDiscussionUnavailable] = useState(false);
  const [attackingUserId, setAttackingUserId] = useState("");
  const [attackModalMember, setAttackModalMember] = useState(null);
  const [selectedPowerup, setSelectedPowerup] = useState("settle_the_bet");
  const [selectedProblemId, setSelectedProblemId] = useState("");
  const [challengeProblems, setChallengeProblems] = useState([]);
  const [powerupState, setPowerupState] = useState({
    inventory: {},
    powerups: [],
    activeShieldExpiresAt: null,
  });
  const [pendingAttacks, setPendingAttacks] = useState([]);
  const [shieldNow, setShieldNow] = useState(Date.now());
  const [shieldBusy, setShieldBusy] = useState(false);

  const loadCapsuleArena = useCallback(async () => {
    setIsLoading(true);
    setPageMessage("");

    await runCapsuleMaintenance().catch(() => null);

    const selectCapsule = (columns) =>
      supabase
        .from("time_capsules")
        .select(columns)
        .eq("id", capsuleId)
        .single();

    let capsuleResult = await selectCapsule(
      "id, title, challenge, owner_id, duration_days, visibility, room_code, status, inactive_since, expired_at, starts_at, ends_at, created_at"
    );

    if (
      capsuleResult.error &&
      (capsuleResult.error.code === "42703" ||
        capsuleResult.error.message?.toLowerCase().includes("status"))
    ) {
      capsuleResult = await selectCapsule(
        "id, title, challenge, owner_id, duration_days, visibility, room_code, starts_at, ends_at, created_at"
      );
    }

    const { data: capsuleRow, error: capsuleError } = capsuleResult;

    if (capsuleError) {
      setPageMessage(capsuleError.message);
      setIsLoading(false);
      return;
    }

    if (capsuleRow.status === "expired") {
      setCapsule(null);
      setPageMessage(
        "This Time Capsule expired because it had fewer than 2 active members for 4 continuous days."
      );
      setIsLoading(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("time_capsule_members")
      .select("capsule_id, user_id, invited_by, status, joined_at, created_at")
      .eq("capsule_id", capsuleId);

    if (memberError) {
      setPageMessage(memberError.message);
      setIsLoading(false);
      return;
    }

    const normalizedMembers = (memberRows || []).map((member) => ({
      userId: String(member.user_id),
      invitedBy: String(member.invited_by),
      status: member.status,
      joinedAt: member.joined_at,
      createdAt: member.created_at,
    }));
    const memberIds = normalizedMembers.map((member) => member.userId);

    const [
      { data: users, error: userError },
      activityResult,
      discussionResult,
    ] = await Promise.all([
      supabase
        .from("lusers")
        .select("id, username, uusername, profile_pic, xp, country"),
      memberIds.length
        ? supabase
            .from("user_activity")
            .select("id, user_id, problem_id, activity_date, metadata, created_at")
            .eq("activity_type", "problem_submission")
            .in("user_id", memberIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("time_capsule_messages")
        .select("id, capsule_id, sender_id, sender_name, message, created_at")
        .eq("capsule_id", capsuleId)
        .order("created_at", { ascending: true }),
    ]);

    if (userError || activityResult.error) {
      setPageMessage((userError || activityResult.error).message);
      setIsLoading(false);
      return;
    }

    const nextUsersById = {};
    (users || []).forEach((user) => {
      nextUsersById[String(user.id)] = user;
    });

    setCapsule({
      id: capsuleRow.id,
      title: capsuleRow.title,
      challenge: capsuleRow.challenge,
      ownerId: String(capsuleRow.owner_id),
      durationDays: capsuleRow.duration_days,
      visibility: capsuleRow.visibility || "private",
      roomCode: capsuleRow.room_code || "",
      status: capsuleRow.status || "active",
      inactiveSince: capsuleRow.inactive_since || null,
      expiredAt: capsuleRow.expired_at || null,
      startsAt: capsuleRow.starts_at,
      endsAt: capsuleRow.ends_at,
      createdAt: capsuleRow.created_at,
    });
    setMembers(normalizedMembers);
    setUsersById(nextUsersById);
    setActivityRows(activityResult.data || []);

    if (discussionResult.error) {
      setMessages([]);
      setDiscussionUnavailable(true);
    } else {
      setMessages(discussionResult.data || []);
      setDiscussionUnavailable(false);
    }

    setIsLoading(false);
  }, [capsuleId]);

  useEffect(() => {
    loadCapsuleArena();
  }, [loadCapsuleArena]);

  const loadCombatState = useCallback(async () => {
    if (!currentUserId) return;

    const [inventoryResult, pendingResult, problemResult] = await Promise.all([
      loadPowerupInventory(currentUserId),
      loadPendingCapsuleAttacks({ userId: currentUserId, capsuleId }),
      loadProblemPage(currentUserId, { page: 1, pageSize: 25 }),
    ]);

    const normalizedInventory = normalizeInventory(
      inventoryResult.inventory || {},
      inventoryResult.powerups || []
    );

    setPowerupState({
      inventory: normalizedInventory,
      powerups: inventoryResult.powerups || [],
      activeShieldExpiresAt: inventoryResult.activeShieldExpiresAt || null,
    });
    setPendingAttacks(pendingResult.attacks || []);
    setChallengeProblems(problemResult.problems || []);
  }, [capsuleId, currentUserId]);

  useEffect(() => {
    loadCombatState().catch(() => null);
  }, [loadCombatState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShieldNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const memberStats = useMemo(() => {
    return members
      .filter((member) => member.status !== "declined")
      .map((member) => {
        const user = usersById[member.userId] || {};
        const memberActivity = activityRows.filter(
          (row) => String(row.user_id) === member.userId
        );
        const solvedProblems = new Set(
          memberActivity.map((row) => row.problem_id).filter(Boolean)
        ).size;
        const activeDays = new Set(
          memberActivity.map((row) => row.activity_date).filter(Boolean)
        ).size;
        const xp = Number(user.xp || 0);

        return {
          ...member,
          user,
          name: getDisplayName(user),
          xp,
          solvedProblems,
          activeDays,
          score: xp + solvedProblems * 25 + activeDays * 10,
          activity: memberActivity,
        };
      })
      .sort((first, second) => second.score - first.score || second.xp - first.xp);
  }, [activityRows, members, usersById]);

  const recentDays = useMemo(buildRecentDays, []);
  const chartSeries = useMemo(() => {
    const series = memberStats.slice(0, 4).map((member, memberIndex) => {
      let cumulative = 0;
      const values = recentDays.map((day) => {
        cumulative += member.activity.filter(
          (row) => row.activity_date === day.key
        ).length;
        return cumulative;
      });

      return {
        id: member.userId,
        name: member.name,
        color: GRAPH_COLORS[memberIndex % GRAPH_COLORS.length],
        values,
      };
    });

    const maxValue = Math.max(
      1,
      ...series.flatMap((memberSeries) => memberSeries.values)
    );

    return { series, maxValue };
  }, [memberStats, recentDays]);

  const sendDiscussionMessage = async (event) => {
    event.preventDefault();
    const text = messageText.trim();

    if (!text || discussionUnavailable) {
      return;
    }

    const { error } = await supabase.from("time_capsule_messages").insert({
      capsule_id: capsuleId,
      sender_id: currentUserId,
      sender_name: getDisplayName(currentUser),
      message: text,
    });

    if (error) {
      showAppToast(error.message, "error");
      return;
    }

    setMessageText("");
    await loadCapsuleArena();
  };

  const usableAttackPowerups = useMemo(
    () =>
      Object.entries(ATTACK_POWERUP_LABELS).filter(
        ([powerupName]) => Number(powerupState.inventory?.[powerupName] || 0) > 0
      ),
    [powerupState.inventory]
  );

  const pendingDefenseByAttackerId = useMemo(() => {
    const entries = pendingAttacks
      .filter((attack) => attack.problemId)
      .map((attack) => [attack.attackerId, attack]);

    return new Map(entries);
  }, [pendingAttacks]);

  const shieldExpiresAt = powerupState.activeShieldExpiresAt;
  const shieldRemainingMs = Math.max(
    0,
    shieldExpiresAt ? new Date(shieldExpiresAt).getTime() - shieldNow : 0
  );
  const shieldIsActive = shieldRemainingMs > 0;
  const shieldQuantity = Number(powerupState.inventory?.shield || 0);

  const formatShieldTime = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  const openAttackModal = (member) => {
    if (!member?.userId || member.userId === currentUserId) return;

    const defaultPowerup = usableAttackPowerups[0]?.[0] || "settle_the_bet";
    setSelectedPowerup(defaultPowerup);
    setSelectedProblemId(challengeProblems[0]?.id || "");
    setAttackModalMember(member);
  };

  const closeAttackModal = () => {
    if (attackingUserId) return;
    setAttackModalMember(null);
  };

  const attackMember = async () => {
    const member = attackModalMember;
    if (!member?.userId || member.userId === currentUserId) {
      return;
    }

    if (usableAttackPowerups.length === 0) {
      showAppToast("You do not have any attack powerups.", "error");
      return;
    }

    if (selectedPowerup === "settle_the_bet" && !selectedProblemId) {
      showAppToast("Choose the problem number before attacking.", "error");
      return;
    }

    setAttackingUserId(member.userId);

    try {
      const result = await performCapsuleAttack({
        attackerId: currentUserId,
        targetId: member.userId,
        capsuleId,
        powerupName: selectedPowerup,
        problemId: selectedPowerup === "settle_the_bet" ? selectedProblemId : null,
        challengeText:
          selectedPowerup === "settle_the_bet"
            ? `problem:${selectedProblemId}`
            : undefined,
      });

      showAppToast(result.message || "Attack sent.", "success");
      setAttackModalMember(null);
      await loadCombatState();
      await loadCapsuleArena();
    } catch (error) {
      showAppToast(error.message, "error");
    } finally {
      setAttackingUserId("");
    }
  };

  const activateUserShield = async () => {
    if (!currentUserId || shieldBusy || shieldIsActive) return;

    setShieldBusy(true);
    try {
      const result = await activateShield({ userId: currentUserId });
      showAppToast(result.message || "Shield activated.", "success");
      await loadCombatState();
    } catch (error) {
      showAppToast(error.message, "error");
    } finally {
      setShieldBusy(false);
    }
  };

  const defendAttack = (attack) => {
    if (!attack?.problemId) {
      showAppToast("This attack does not have a challenge problem.", "error");
      return;
    }

    navigate(
      `/problems/${attack.problemId}?attackId=${encodeURIComponent(
        attack.id
      )}&capsuleId=${encodeURIComponent(capsuleId)}`
    );
  };

  if (isLoading) {
    return (
      <div className="page clan-page capsule-detail-page">
        <p className="clan-loading">Loading Time Capsule arena...</p>
      </div>
    );
  }

  if (!capsule) {
    return (
      <div className="page clan-page capsule-detail-page">
        <p className="capsule-empty">{pageMessage || "Time Capsule not found."}</p>
      </div>
    );
  }

  const joinedCount = memberStats.filter((member) => member.status === "joined").length;

  return (
    <div className="page clan-page capsule-detail-page">
      <div className="capsule-detail-header">
        <div>
          <span className="clan-eyebrow">Live commitment arena</span>
          <h1>{capsule.title}</h1>
          <p>{capsule.challenge}</p>
        </div>
        <div className="capsule-live-code">
          <span>{capsule.visibility}</span>
          <strong>{capsule.roomCode || "No code"}</strong>
        </div>
        {(shieldIsActive || shieldQuantity > 0) && (
          <div className="capsule-shield-panel">
            <button
              type="button"
              onClick={activateUserShield}
              disabled={shieldIsActive || shieldBusy}
            >
              {shieldIsActive ? "Shield Active" : "Activate Shield"}
            </button>
            <small>
              {shieldIsActive
                ? `${formatShieldTime(shieldRemainingMs)} remaining`
                : `${shieldQuantity} shield${shieldQuantity === 1 ? "" : "s"} ready`}
            </small>
          </div>
        )}
      </div>

      <section className="capsule-score-strip">
        <div>
          <span>Days left</span>
          <strong>{getDaysRemaining(capsule.endsAt)}</strong>
        </div>
        <div>
          <span>Joined</span>
          <strong>{joinedCount}/{memberStats.length}</strong>
        </div>
        <div>
          <span>Total score</span>
          <strong>
            {memberStats.reduce((sum, member) => sum + member.score, 0)}
          </strong>
        </div>
        <div>
          <span>Active runs</span>
          <strong>{activityRows.length}</strong>
        </div>
      </section>

      <div className="capsule-detail-grid">
        <aside className="capsule-leaderboard-panel">
          <span className="clan-eyebrow">Leaderboard</span>
          {memberStats.map((member, index) => {
            const pendingDefense = pendingDefenseByAttackerId.get(member.userId);

            return (
            <div
              className="capsule-leaderboard-row"
              key={member.userId}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/profile/${member.userId}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  navigate(`/profile/${member.userId}`);
                }
              }}
            >
              <strong>#{index + 1}</strong>
              <span>
                <b>{member.name}</b>
                <small>
                  {member.solvedProblems} solved · {member.activeDays} active days
                </small>
              </span>
              <b>{member.score}</b>
              {pendingDefense ? (
              <button
                className="capsule-defend-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  defendAttack(pendingDefense);
                }}
              >
                Defend
              </button>
              ) : (
              member.userId !== currentUserId && (
              <button
                className="capsule-attack-button"
                type="button"
                disabled={attackingUserId === member.userId}
                onClick={(event) => {
                  event.stopPropagation();
                  openAttackModal(member);
                }}
              >
                Attack
              </button>
              ))}
            </div>
            );
          })}
        </aside>

        <main className="capsule-score-panel">
          <div className="capsule-section-heading">
            <div>
              <span className="clan-eyebrow">IPL style live score</span>
              <h2>Comparison Graph</h2>
            </div>
          </div>

          <div className="capsule-live-graph">
            <svg viewBox="0 0 520 190" role="img" aria-label="Seven day score graph">
              {[0, 1, 2].map((line) => (
                <line
                  key={line}
                  x1="28"
                  x2="500"
                  y1={42 + line * 50}
                  y2={42 + line * 50}
                />
              ))}
              {chartSeries.series.map((memberSeries) => {
                const points = memberSeries.values
                  .map((value, index) => {
                    const x = 42 + index * 74;
                    const y = 152 - (value / chartSeries.maxValue) * 106;
                    return `${x},${y}`;
                  })
                  .join(" ");

                return (
                  <polyline
                    key={memberSeries.id}
                    points={points}
                    style={{ stroke: memberSeries.color }}
                  />
                );
              })}
              {recentDays.map((day, index) => (
                <text key={day.key} x={34 + index * 74} y="178">
                  {day.label}
                </text>
              ))}
            </svg>
            <div className="capsule-graph-legend">
              {chartSeries.series.map((memberSeries) => (
                <span key={memberSeries.id}>
                  <i style={{ background: memberSeries.color }} />
                  {memberSeries.name}
                </span>
              ))}
            </div>
          </div>

        </main>

        <aside className="capsule-discussion-panel">
          <span className="clan-eyebrow">Discussions</span>
          <h2>Capsule Chat</h2>

          {discussionUnavailable ? (
            <p className="capsule-empty">
              Run the updated time capsule SQL to enable discussions.
            </p>
          ) : (
            <>
              <div className="capsule-message-list">
                {messages.length === 0 ? (
                  <p>No messages yet.</p>
                ) : (
                  messages.map((message) => {
                    const isMine = String(message.sender_id) === currentUserId;
                    return (
                      <div
                        className={isMine ? "capsule-message mine" : "capsule-message"}
                        key={message.id}
                      >
                        <strong>
                          {message.sender_name ||
                            getDisplayName(usersById[String(message.sender_id)])}
                        </strong>
                        <p>{message.message}</p>
                        <small>
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                    );
                  })
                )}
              </div>
              <form className="capsule-message-composer" onSubmit={sendDiscussionMessage}>
                <input
                  value={messageText}
                  placeholder="Message the capsule"
                  onChange={(event) => setMessageText(event.target.value)}
                />
                <button type="submit">Send</button>
              </form>
            </>
          )}
        </aside>
      </div>

      {attackModalMember && (
        <div className="capsule-attack-modal-backdrop" role="presentation">
          <div className="capsule-attack-modal" role="dialog" aria-modal="true">
            <div>
              <span className="clan-eyebrow">Choose attack</span>
              <h2>Attack {attackModalMember.name}</h2>
              <p>Select the powerup and problem number for the defender.</p>
            </div>

            {usableAttackPowerups.length === 0 ? (
              <p className="capsule-empty">You do not have any attack powerups.</p>
            ) : (
              <>
                <label>
                  Powerup
                  <select
                    value={selectedPowerup}
                    onChange={(event) => setSelectedPowerup(event.target.value)}
                  >
                    {usableAttackPowerups.map(([powerupName, label]) => (
                      <option key={powerupName} value={powerupName}>
                        {label} ({powerupState.inventory[powerupName]} owned)
                      </option>
                    ))}
                  </select>
                </label>

                {selectedPowerup === "settle_the_bet" && (
                  <label>
                    Problem number
                    <select
                      value={selectedProblemId}
                      onChange={(event) => setSelectedProblemId(event.target.value)}
                    >
                      {challengeProblems.map((problem, index) => (
                        <option key={problem.id} value={problem.id}>
                          {String(index + 1).padStart(2, "0")} - {problem.title} -{" "}
                          {problem.difficulty}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}

            <div className="capsule-attack-modal-actions">
              <button type="button" className="secondary" onClick={closeAttackModal}>
                Cancel
              </button>
              <button
                type="button"
                onClick={attackMember}
                disabled={attackingUserId === attackModalMember.userId}
              >
                {attackingUserId === attackModalMember.userId
                  ? "Sending..."
                  : "Send attack"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

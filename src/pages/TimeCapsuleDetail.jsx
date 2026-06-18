import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/Clan.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRAPH_COLORS = ["#f5c451", "#59d3c6", "#ef6655", "#8fa4ff"];

const getDisplayName = (user) => user?.uusername || user?.username || "Player";

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

  const loadCapsuleArena = useCallback(async () => {
    setIsLoading(true);
    setPageMessage("");

    const { data: capsuleRow, error: capsuleError } = await supabase
      .from("time_capsules")
      .select(
        "id, title, challenge, owner_id, duration_days, visibility, room_code, starts_at, ends_at, created_at"
      )
      .eq("id", capsuleId)
      .single();

    if (capsuleError) {
      setPageMessage(capsuleError.message);
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
      setPageMessage(error.message);
      return;
    }

    setMessageText("");
    await loadCapsuleArena();
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
        <button type="button" onClick={() => navigate("/time-capsules")}>
          Back to capsules
        </button>
        <div>
          <span className="clan-eyebrow">Live commitment arena</span>
          <h1>{capsule.title}</h1>
          <p>{capsule.challenge}</p>
        </div>
        <div className="capsule-live-code">
          <span>{capsule.visibility}</span>
          <strong>{capsule.roomCode || "No code"}</strong>
        </div>
      </div>

      {pageMessage && <p className="clan-message error">{pageMessage}</p>}

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
        <aside className="capsule-friends-panel">
          <span className="clan-eyebrow">Friends</span>
          <h2>Players</h2>
          <div className="capsule-friend-stack">
            {memberStats.map((member) => (
              <button
                type="button"
                key={member.userId}
                onClick={() => navigate(`/profile/${member.userId}`)}
              >
                {member.user.profile_pic ? (
                  <img src={member.user.profile_pic} alt="" />
                ) : (
                  <span>{member.name.charAt(0)}</span>
                )}
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.status}</small>
                </div>
              </button>
            ))}
          </div>
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

          <section className="capsule-leaderboard-panel">
            <span className="clan-eyebrow">Leaderboard</span>
            {memberStats.map((member, index) => (
              <button
                type="button"
                className="capsule-leaderboard-row"
                key={member.userId}
                onClick={() => navigate(`/profile/${member.userId}`)}
              >
                <strong>#{index + 1}</strong>
                <span>
                  <b>{member.name}</b>
                  <small>
                    {member.solvedProblems} solved · {member.activeDays} active days
                  </small>
                </span>
                <b>{member.score}</b>
              </button>
            ))}
          </section>
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
    </div>
  );
}

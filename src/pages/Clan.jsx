import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/Clan.css";

const RECOMMENDED_DURATIONS = [30, 60, 90, 120];
const MIN_DURATION = 7;
const MAX_DURATION = 365;
const RECOMMENDED_ACTIVE_LIMIT = 3;

const getDisplayName = (user) => user?.uusername || user?.username || "Friend";

const getDaysRemaining = (endsAt) => {
  const milliseconds = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(milliseconds / 86400000));
};

const getCapsuleMode = (memberCount) => {
  if (memberCount === 2) {
    return "Duel War Zone";
  }

  if (memberCount <= 4) {
    return "Squad Challenge";
  }

  return "Clan Expedition";
};

const mapClanRows = (clanRows = [], memberRows = []) =>
  clanRows.map((clan) => ({
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    ownerId: clan.owner_id,
    createdAt: clan.created_at,
    memberIds: memberRows
      .filter((member) => member.clan_id === clan.id)
      .map((member) => String(member.user_id)),
  }));

const mapCapsuleRows = (capsuleRows = [], memberRows = []) =>
  capsuleRows.map((capsule) => ({
    id: capsule.id,
    title: capsule.title,
    challenge: capsule.challenge,
    ownerId: String(capsule.owner_id),
    durationDays: capsule.duration_days,
    startsAt: capsule.starts_at,
    endsAt: capsule.ends_at,
    createdAt: capsule.created_at,
    members: memberRows
      .filter((member) => member.capsule_id === capsule.id)
      .map((member) => ({
        userId: String(member.user_id),
        status: member.status,
        joinedAt: member.joined_at,
      })),
  }));

export default function Clan({ pageMode = "clans" }) {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
  const currentUserId = String(currentUser.id);

  const [activeView, setActiveView] = useState(
    pageMode === "capsules" ? "capsules" : "clans"
  );
  const [clans, setClans] = useState([]);
  const [capsules, setCapsules] = useState([]);
  const [friends, setFriends] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [clanName, setClanName] = useState("");
  const [clanTag, setClanTag] = useState("");
  const [capsuleTitle, setCapsuleTitle] = useState("");
  const [capsuleChallenge, setCapsuleChallenge] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCapsule, setIsCreatingCapsule] = useState(false);

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadClans = useCallback(async () => {
    const [
      { data: clanRows, error: clanError },
      { data: memberRows, error: memberError },
    ] = await Promise.all([
      supabase
        .from("clans")
        .select("id, name, tag, owner_id, created_at")
        .order("created_at", { ascending: true }),
      supabase.from("clan_members").select("clan_id, user_id, created_at"),
    ]);

    if (clanError || memberError) {
      throw clanError || memberError;
    }

    setClans(mapClanRows(clanRows || [], memberRows || []));
  }, []);

  const loadCapsules = useCallback(async () => {
    const [
      { data: capsuleRows, error: capsuleError },
      { data: memberRows, error: memberError },
    ] = await Promise.all([
      supabase
        .from("time_capsules")
        .select(
          "id, title, challenge, owner_id, duration_days, starts_at, ends_at, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("time_capsule_members")
        .select("capsule_id, user_id, status, joined_at"),
    ]);

    if (capsuleError || memberError) {
      const error = capsuleError || memberError;

      if (error.code === "42P01" || error.message?.includes("time_capsule")) {
        throw new Error(
          "Time Capsule tables are missing. Run backend/time-capsule-schema.sql in Supabase."
        );
      }

      throw error;
    }

    setCapsules(mapCapsuleRows(capsuleRows || [], memberRows || []));
  }, []);

  const loadUsersAndFriends = useCallback(async () => {
    const [
      { data: users, error: userError },
      { data: relations, error: friendError },
    ] = await Promise.all([
      supabase.from("lusers").select("*"),
      supabase.from("friends").select("*"),
    ]);

    if (userError || friendError) {
      throw userError || friendError;
    }

    const nextUsersById = {};
    (users || []).forEach((user) => {
      nextUsersById[String(user.id)] = user;
    });
    setUsersById(nextUsersById);

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

    setFriends(
      (users || []).filter((user) => friendIds.has(String(user.id)))
    );
  }, [currentUserId]);

  const loadPage = useCallback(async () => {
    setIsLoading(true);

    try {
      await Promise.all(
        pageMode === "capsules"
          ? [loadCapsules(), loadUsersAndFriends()]
          : [loadClans(), loadUsersAndFriends()]
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [loadCapsules, loadClans, loadUsersAndFriends, pageMode]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const rankedClans = useMemo(
    () =>
      clans
        .map((clan) => ({
          ...clan,
          memberCount: clan.memberIds.length,
          totalXp: clan.memberIds.reduce(
            (sum, memberId) => sum + Number(usersById[memberId]?.xp || 0),
            0
          ),
        }))
        .sort((a, b) => b.totalXp - a.totalXp || b.memberCount - a.memberCount),
    [clans, usersById]
  );

  const myClan = clans.find((clan) => clan.memberIds.includes(currentUserId));

  const myCapsules = useMemo(
    () =>
      capsules.filter((capsule) =>
        capsule.members.some((member) => member.userId === currentUserId)
      ),
    [capsules, currentUserId]
  );

  const activeJoinedCapsules = useMemo(
    () =>
      myCapsules.filter(
        (capsule) =>
          getDaysRemaining(capsule.endsAt) > 0 &&
          capsule.members.some(
            (member) =>
              member.userId === currentUserId && member.status === "joined"
          )
      ),
    [currentUserId, myCapsules]
  );

  const visibleCapsules = myCapsules.filter(
    (capsule) =>
      getDaysRemaining(capsule.endsAt) > 0 &&
      capsule.members.some(
        (member) =>
          member.userId === currentUserId && member.status !== "declined"
      )
  );

  const confirmBeyondRecommendedLimit = () => {
    if (activeJoinedCapsules.length < RECOMMENDED_ACTIVE_LIMIT) {
      return true;
    }

    return window.confirm(
      "You already have 3 active Time Capsules. We recommend focusing on no more than 3 challenge tracks at once. Continue anyway?"
    );
  };

  const updateMembership = async (clanId) => {
    showMessage("");

    const { error: deleteError } = await supabase
      .from("clan_members")
      .delete()
      .eq("user_id", currentUserId);

    if (deleteError) {
      showMessage(deleteError.message, "error");
      return;
    }

    const { error: insertError } = await supabase.from("clan_members").insert({
      clan_id: clanId,
      user_id: currentUserId,
    });

    if (insertError) {
      showMessage(insertError.message, "error");
      return;
    }

    showMessage(`Joined ${clans.find((clan) => clan.id === clanId)?.name}`);
    await loadClans();
  };

  const createClan = async () => {
    const name = clanName.trim();
    const tag = clanTag.trim().toUpperCase();
    showMessage("");

    if (!name || tag.length < 2 || tag.length > 8) {
      showMessage("Enter a clan name and a tag between 2 and 8 characters.", "error");
      return;
    }

    const { data: newClan, error: clanError } = await supabase
      .from("clans")
      .insert({ name, tag, owner_id: currentUserId })
      .select("id")
      .single();

    if (clanError) {
      showMessage(clanError.message, "error");
      return;
    }

    await supabase.from("clan_members").delete().eq("user_id", currentUserId);
    const { error: memberError } = await supabase.from("clan_members").insert({
      clan_id: newClan.id,
      user_id: currentUserId,
    });

    if (memberError) {
      showMessage(memberError.message, "error");
      return;
    }

    setClanName("");
    setClanTag("");
    setActiveView("clans");
    showMessage(`Created ${name}`);
    await loadClans();
  };

  const toggleFriend = (friendId) => {
    const normalizedId = String(friendId);
    setSelectedFriendIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    );
  };

  const createCapsule = async () => {
    const title = capsuleTitle.trim();
    const challenge = capsuleChallenge.trim();
    const normalizedDuration = Number(durationDays);

    showMessage("");

    if (!title || !challenge) {
      showMessage("Give the capsule a name and challenge focus.", "error");
      return;
    }

    if (
      !Number.isInteger(normalizedDuration) ||
      normalizedDuration < MIN_DURATION ||
      normalizedDuration > MAX_DURATION
    ) {
      showMessage("Duration must be between 7 and 365 days.", "error");
      return;
    }

    if (selectedFriendIds.length === 0) {
      showMessage("Invite at least one friend to create a Time Capsule.", "error");
      return;
    }

    if (!confirmBeyondRecommendedLimit()) {
      return;
    }

    setIsCreatingCapsule(true);
    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() + normalizedDuration * 86400000
    );

    const { data: capsule, error: capsuleError } = await supabase
      .from("time_capsules")
      .insert({
        title,
        challenge,
        owner_id: currentUserId,
        duration_days: normalizedDuration,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id")
      .single();

    if (capsuleError) {
      showMessage(capsuleError.message, "error");
      setIsCreatingCapsule(false);
      return;
    }

    const memberRows = [
      {
        capsule_id: capsule.id,
        user_id: currentUserId,
        invited_by: currentUserId,
        status: "joined",
        joined_at: startsAt.toISOString(),
      },
      ...selectedFriendIds.map((friendId) => ({
        capsule_id: capsule.id,
        user_id: friendId,
        invited_by: currentUserId,
        status: "invited",
        joined_at: null,
      })),
    ];

    const { error: memberError } = await supabase
      .from("time_capsule_members")
      .insert(memberRows);

    if (memberError) {
      await supabase.from("time_capsules").delete().eq("id", capsule.id);
      showMessage(memberError.message, "error");
      setIsCreatingCapsule(false);
      return;
    }

    setCapsuleTitle("");
    setCapsuleChallenge("");
    setSelectedFriendIds([]);
    setDurationDays(30);
    setIsCreatingCapsule(false);
    showMessage(
      `Created ${title} as ${getCapsuleMode(memberRows.length)}. Invitations sent.`
    );
    await loadCapsules();
  };

  const joinCapsule = async (capsuleId) => {
    if (!confirmBeyondRecommendedLimit()) {
      return;
    }

    const { error } = await supabase
      .from("time_capsule_members")
      .update({
        status: "joined",
        joined_at: new Date().toISOString(),
      })
      .eq("capsule_id", capsuleId)
      .eq("user_id", currentUserId);

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    showMessage("Time Capsule joined. Keep the streak alive.");
    await loadCapsules();
  };

  const declineCapsule = async (capsuleId) => {
    const { error } = await supabase
      .from("time_capsule_members")
      .update({ status: "declined" })
      .eq("capsule_id", capsuleId)
      .eq("user_id", currentUserId);

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    showMessage("Invitation declined.");
    await loadCapsules();
  };

  const renderCapsuleCard = (capsule) => {
    const currentMembership = capsule.members.find(
      (member) => member.userId === currentUserId
    );
    const participantCount = capsule.members.filter(
      (member) => member.status !== "declined"
    ).length;
    const joinedCount = capsule.members.filter(
      (member) => member.status === "joined"
    ).length;
    const daysRemaining = getDaysRemaining(capsule.endsAt);

    return (
      <article className="capsule-card" key={capsule.id}>
        <div className="capsule-card-top">
          <span className="capsule-mode">{getCapsuleMode(participantCount)}</span>
          <strong>{daysRemaining} days left</strong>
        </div>
        <h3>{capsule.title}</h3>
        <p>{capsule.challenge}</p>
        <div className="capsule-progress">
          <span
            style={{
              width: `${Math.max(
                4,
                ((capsule.durationDays - daysRemaining) / capsule.durationDays) *
                  100
              )}%`,
            }}
          />
        </div>
        <div className="capsule-meta">
          <span>{capsule.durationDays} day challenge</span>
          <span>
            {joinedCount}/{participantCount} joined
          </span>
        </div>
        <div className="capsule-members">
          {capsule.members
            .filter((member) => member.status !== "declined")
            .slice(0, 5)
            .map((member) => (
              <span
                className={member.status === "joined" ? "joined" : ""}
                key={member.userId}
                title={`${getDisplayName(usersById[member.userId])}: ${
                  member.status
                }`}
              >
                {getDisplayName(usersById[member.userId]).charAt(0)}
              </span>
            ))}
        </div>
        {currentMembership?.status === "invited" && (
          <div className="capsule-actions">
            <button className="capsule-primary" onClick={() => joinCapsule(capsule.id)}>
              Join challenge
            </button>
            <button
              className="capsule-secondary"
              onClick={() => declineCapsule(capsule.id)}
            >
              Decline
            </button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="page clan-page">
      <div className="clan-page-header">
        <div>
          <span className="clan-eyebrow">
            {pageMode === "capsules" ? "Challenge commitments" : "Social competition"}
          </span>
          <h1>{pageMode === "capsules" ? "Time Capsules" : "Clans"}</h1>
          <p>
            {pageMode === "capsules"
              ? "Commit to a learning challenge with friends and protect your streak."
              : "Find a team, compare clan XP, and compete together."}
          </p>
        </div>
        <button className="clan-back-button" onClick={() => navigate("/home")}>
          Back
        </button>
      </div>

      {message && <p className={`clan-message ${messageType}`}>{message}</p>}

      <div
        className={
          pageMode === "capsules" ? "clan-layout capsule-page-layout" : "clan-layout"
        }
      >
        {pageMode === "clans" && (
          <aside className="clan-rail">
            <div className="my-clan-summary">
              <span>Current clan</span>
              <strong>{myClan?.name || "No clan joined"}</strong>
              <small>{myClan ? `[${myClan.tag}]` : "Choose your team"}</small>
            </div>

            <nav className="clan-navigation" aria-label="Clan page sections">
              <button
                className={activeView === "clans" ? "active" : ""}
                onClick={() => setActiveView("clans")}
              >
                Find Clans
              </button>
              <button
                className={activeView === "ranking" ? "active" : ""}
                onClick={() => setActiveView("ranking")}
              >
                Clan Ranking
              </button>
              <button
                className={activeView === "create-clan" ? "active" : ""}
                onClick={() => setActiveView("create-clan")}
              >
                Create Clan
              </button>
              <button
                className={
                  activeView === "aura" ? "active aura-button" : "aura-button"
                }
                onClick={() => setActiveView("aura")}
              >
                Aura Farming
                <small>Soon</small>
              </button>
            </nav>
          </aside>
        )}

        <main className="clan-main">
          {isLoading && <p className="clan-loading">Loading arena data...</p>}

          {!isLoading && activeView === "capsules" && (
            <>
              <section className="capsule-hero">
                <div>
                  <span className="clan-eyebrow">Commit together</span>
                  <h2>Create a Time Capsule</h2>
                  <p>
                    Invite friends into a fixed learning challenge. Seven days is
                    the minimum; 30, 60, 90, and 120 days are recommended.
                  </p>
                </div>
                <div className="capsule-rule">
                  <strong>2 players</strong>
                  <span>becomes a Duel War Zone</span>
                </div>
              </section>

              <section className="capsule-create-panel">
                <div className="capsule-form-grid">
                  <label>
                    <span>Capsule name</span>
                    <input
                      value={capsuleTitle}
                      placeholder="Example: 60 Days of DSA"
                      onChange={(event) => setCapsuleTitle(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Challenge focus</span>
                    <input
                      value={capsuleChallenge}
                      placeholder="Example: Solve one medium problem daily"
                      onChange={(event) => setCapsuleChallenge(event.target.value)}
                    />
                  </label>
                </div>

                <div className="duration-section">
                  <div className="duration-heading">
                    <span>Duration</span>
                    <small>Minimum 7 days, maximum 365 days</small>
                  </div>
                  <div className="duration-options">
                    {RECOMMENDED_DURATIONS.map((days) => (
                      <button
                        className={durationDays === days ? "active" : ""}
                        key={days}
                        onClick={() => setDurationDays(days)}
                      >
                        <strong>{days}</strong>
                        <span>days</span>
                      </button>
                    ))}
                    <label className="custom-duration">
                      <span>Custom</span>
                      <input
                        type="number"
                        min={MIN_DURATION}
                        max={MAX_DURATION}
                        value={durationDays}
                        onChange={(event) =>
                          setDurationDays(Number(event.target.value))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="friend-invite-section">
                  <div className="duration-heading">
                    <span>Invite friends</span>
                    <small>At least one friend is required</small>
                  </div>
                  {friends.length === 0 ? (
                    <p className="capsule-empty">
                      Add a friend before creating a Time Capsule.
                    </p>
                  ) : (
                    <div className="friend-invite-list">
                      {friends.map((friend) => (
                        <label key={friend.id}>
                          <input
                            type="checkbox"
                            checked={selectedFriendIds.includes(String(friend.id))}
                            onChange={() => toggleFriend(friend.id)}
                          />
                          <span>{getDisplayName(friend)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="capsule-create-button"
                  disabled={isCreatingCapsule}
                  onClick={createCapsule}
                >
                  {isCreatingCapsule ? "Sealing capsule..." : "Create Time Capsule"}
                </button>
              </section>

              <section className="capsule-list-section">
                <div className="capsule-section-heading">
                  <div>
                    <span className="clan-eyebrow">Your commitments</span>
                    <h2>Active Time Capsules</h2>
                  </div>
                  <strong>{activeJoinedCapsules.length} active</strong>
                </div>

                {visibleCapsules.length === 0 ? (
                  <p className="capsule-empty">
                    No Time Capsules yet. Create one with a friend to begin.
                  </p>
                ) : (
                  <div className="capsule-grid">
                    {visibleCapsules.map(renderCapsuleCard)}
                  </div>
                )}
              </section>
            </>
          )}

          {!isLoading && activeView === "clans" && (
            <section>
              <div className="capsule-section-heading">
                <div>
                  <span className="clan-eyebrow">Find your team</span>
                  <h2>Available Clans</h2>
                </div>
              </div>
              <div className="clan-card-grid">
                {rankedClans.map((clan) => {
                  const isJoined = clan.memberIds.includes(currentUserId);
                  return (
                    <article className="side-clan-card" key={clan.id}>
                      <div>
                        <span>[{clan.tag}]</span>
                        <h3>{clan.name}</h3>
                      </div>
                      <strong>{clan.totalXp} XP</strong>
                      <p>{clan.memberCount} members</p>
                      <button
                        disabled={isJoined}
                        onClick={() => updateMembership(clan.id)}
                      >
                        {isJoined ? "Current clan" : "Join clan"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {!isLoading && activeView === "ranking" && (
            <section>
              <div className="capsule-section-heading">
                <div>
                  <span className="clan-eyebrow">Leaderboard</span>
                  <h2>Clan Ranking</h2>
                </div>
              </div>
              <div className="clan-ranking-list">
                {rankedClans.map((clan, index) => (
                  <div key={clan.id}>
                    <strong>#{index + 1}</strong>
                    <span>
                      <b>{clan.name}</b>
                      <small>
                        [{clan.tag}] {clan.memberCount} members
                      </small>
                    </span>
                    <b>{clan.totalXp} XP</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeView === "create-clan" && (
            <section className="clan-form-panel">
              <span className="clan-eyebrow">Lead a team</span>
              <h2>Create Clan</h2>
              <label>
                <span>Clan name</span>
                <input
                  value={clanName}
                  placeholder="Clan name"
                  onChange={(event) => setClanName(event.target.value)}
                />
              </label>
              <label>
                <span>Clan tag</span>
                <input
                  value={clanTag}
                  placeholder="2 to 8 characters"
                  maxLength={8}
                  onChange={(event) => setClanTag(event.target.value)}
                />
              </label>
              <button onClick={createClan}>Create Clan</button>
            </section>
          )}

          {activeView === "aura" && (
            <section className="aura-placeholder">
              <span className="clan-eyebrow">Upcoming system</span>
              <h2>Aura Farming</h2>
              <p>
                Aura will reward consistency, support, and challenge completion.
                The farming rules and progression design will be added later.
              </p>
              <div>
                <span>Daily consistency</span>
                <span>Team support</span>
                <span>Challenge milestones</span>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../shared/services/supabase";
import { runCapsuleMaintenance } from "../../powerups/api/powerupApi";
import { showAppToast } from "../../../shared/utils/appToast";
import "../../../styles/features/Clan.css";

const MIN_DURATION = 7;
const MAX_DURATION = 365;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const clampDuration = (days) =>
  Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(days) || MIN_DURATION));

const getDisplayName = (user) => user?.uusername || user?.username || "Friend";

const getDaysRemaining = (endsAt) => {
  const milliseconds = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(milliseconds / 86400000));
};

const getCapsuleMode = (memberCount) => {
  if (memberCount <= 4) {
    return "Squad Challenge";
  }

  return "Clan Expedition";
};

const generateRoomCode = () =>
  Array.from(
    { length: 8 },
    () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  ).join("");

const normalizeRoomCode = (value) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

const mapClanRows = (clanRows = [], memberRows = [], rankingRows = []) => {
  const rankingsByClanId = {};
  rankingRows.forEach((ranking) => {
    rankingsByClanId[ranking.id] = ranking;
  });

  return clanRows.map((clan) => {
    const ranking = rankingsByClanId[clan.id] || {};
    const members = memberRows
      .filter((member) => member.clan_id === clan.id)
      .map((member) => {
        const userId = String(member.user_id);

        return {
          userId,
          role:
            member.role ||
            (userId === String(clan.owner_id) ? "admin" : "member"),
          joinedAt: member.created_at,
        };
      });

    return {
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      ownerId: String(clan.owner_id),
      createdAt: clan.created_at,
      members,
      memberIds: members.map((member) => member.userId),
      ranking,
    };
  });
};

const mapCapsuleRows = (capsuleRows = [], memberRows = []) =>
  capsuleRows.map((capsule) => ({
    id: capsule.id,
    title: capsule.title,
    challenge: capsule.challenge,
    ownerId: String(capsule.owner_id),
    durationDays: capsule.duration_days,
    visibility: capsule.visibility || "private",
    roomCode: capsule.room_code || "",
    status: capsule.status || "active",
    inactiveSince: capsule.inactive_since || null,
    expiredAt: capsule.expired_at || null,
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
  const [progressByUserId, setProgressByUserId] = useState({});
  const [clanName, setClanName] = useState("");
  const [clanTag, setClanTag] = useState("");
  const [clanSearchQuery, setClanSearchQuery] = useState("");
  const [selectedClanId, setSelectedClanId] = useState("");
  const [capsuleTitle, setCapsuleTitle] = useState("");
  const [capsuleChallenge, setCapsuleChallenge] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [capsuleVisibility, setCapsuleVisibility] = useState("private");
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [friendInviteQuery, setFriendInviteQuery] = useState("");
  const [roomCodeQuery, setRoomCodeQuery] = useState("");
  const [roomCodeResult, setRoomCodeResult] = useState(null);
  const [isSearchingRoom, setIsSearchingRoom] = useState(false);
  const [duelOpponentId, setDuelOpponentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCapsule, setIsCreatingCapsule] = useState(false);
  const durationWheelRef = useRef(null);
  const durationWheelCleanupRef = useRef(null);
  const durationKeyBufferRef = useRef("");
  const durationKeyTimerRef = useRef(null);

  const showMessage = (text, type = "success") => {
    showAppToast(text, type);
  };

  const loadClans = useCallback(async () => {
    const { data: clanRows, error: clanError } = await supabase
      .from("clans")
      .select("id, name, tag, owner_id, created_at")
      .order("created_at", { ascending: true });

    let memberResponse = await supabase
      .from("clan_members")
      .select("clan_id, user_id, role, created_at");

    if (
      memberResponse.error &&
      (memberResponse.error.code === "42703" ||
        memberResponse.error.message?.toLowerCase().includes("role"))
    ) {
      memberResponse = await supabase
        .from("clan_members")
        .select("clan_id, user_id, created_at");
    }

    const { data: memberRows, error: memberError } = memberResponse;

    if (clanError || memberError) {
      throw clanError || memberError;
    }

    const { data: rankingRows, error: rankingError } = await supabase
      .from("clan_rankings")
      .select("id, rank, member_count, total_xp, solved_count, attempts");

    setClans(
      mapClanRows(
        clanRows || [],
        memberRows || [],
        rankingError ? [] : rankingRows || []
      )
    );
  }, []);

  const loadCapsules = useCallback(async () => {
    await runCapsuleMaintenance().catch(() => null);

    const selectCapsules = (columns) =>
      supabase
        .from("time_capsules")
        .select(columns)
        .order("created_at", { ascending: false });

    let capsuleResult = await selectCapsules(
      "id, title, challenge, owner_id, duration_days, visibility, room_code, status, inactive_since, expired_at, starts_at, ends_at, created_at"
    );

    if (
      capsuleResult.error &&
      (capsuleResult.error.code === "42703" ||
        capsuleResult.error.message?.toLowerCase().includes("status"))
    ) {
      capsuleResult = await selectCapsules(
        "id, title, challenge, owner_id, duration_days, visibility, room_code, starts_at, ends_at, created_at"
      );
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("time_capsule_members")
      .select("capsule_id, user_id, status, joined_at");

    const { data: capsuleRows, error: capsuleError } = capsuleResult;

    if (capsuleError || memberError) {
      const error = capsuleError || memberError;

      if (error.code === "42P01" || error.message?.includes("time_capsule")) {
        throw new Error(
          "Time Capsule tables are missing. Run backend/schemas/time-capsule-schema.sql in Supabase."
        );
      }

      throw error;
    }

    setCapsules(
      mapCapsuleRows(capsuleRows || [], memberRows || []).filter(
        (capsule) => capsule.status !== "expired"
      )
    );
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

    const { data: progressRows, error: progressError } = await supabase
      .from("user_problem_progress")
      .select("user_id, problem_id, solved_at, attempts, xp_awarded");

    if (!progressError) {
      const nextProgressByUserId = {};
      (progressRows || []).forEach((row) => {
        const userId = String(row.user_id);
        if (!nextProgressByUserId[userId]) {
          nextProgressByUserId[userId] = {
            solvedCount: 0,
            attempts: 0,
            xpAwarded: 0,
          };
        }

        nextProgressByUserId[userId].attempts += Number(row.attempts || 0);
        nextProgressByUserId[userId].xpAwarded += Number(row.xp_awarded || 0);

        if (row.solved_at) {
          nextProgressByUserId[userId].solvedCount += 1;
        }
      });
      setProgressByUserId(nextProgressByUserId);
    } else {
      setProgressByUserId({});
    }

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
    () => {
      const sortedClans = clans
        .map((clan) => {
          const memberStats = clan.memberIds.reduce(
            (stats, memberId) => {
              const progress = progressByUserId[memberId] || {};
              stats.totalXp += Number(usersById[memberId]?.xp || 0);
              stats.solvedCount += Number(progress.solvedCount || 0);
              stats.attempts += Number(progress.attempts || 0);
              return stats;
            },
            { totalXp: 0, solvedCount: 0, attempts: 0 }
          );

          return {
            ...clan,
            memberCount: Number(
              clan.ranking?.member_count ?? clan.memberIds.length
            ),
            totalXp: Number(clan.ranking?.total_xp ?? memberStats.totalXp),
            solvedCount: Number(
              clan.ranking?.solved_count ?? memberStats.solvedCount
            ),
            attempts: Number(clan.ranking?.attempts ?? memberStats.attempts),
          };
        })
        .sort(
          (a, b) =>
            b.totalXp - a.totalXp ||
            b.solvedCount - a.solvedCount ||
            b.memberCount - a.memberCount ||
            a.name.localeCompare(b.name)
        );

      return sortedClans.map((clan, index) => ({
        ...clan,
        rank: index + 1,
      }));
    },
    [clans, progressByUserId, usersById]
  );

  const myClan = clans.find((clan) => clan.memberIds.includes(currentUserId));

  const filteredRankedClans = useMemo(() => {
    const query = clanSearchQuery.trim().toLowerCase();

    if (!query) {
      return rankedClans;
    }

    return rankedClans.filter((clan) => {
      const clanFields = [clan.name, clan.tag, `#${clan.rank}`]
        .join(" ")
        .toLowerCase();
      const memberFields = clan.memberIds
        .map((memberId) => {
          const member = usersById[memberId] || {};
          return [
            getDisplayName(member),
            member.username,
            member.country,
          ].join(" ");
        })
        .join(" ")
        .toLowerCase();

      return `${clanFields} ${memberFields}`.includes(query);
    });
  }, [clanSearchQuery, rankedClans, usersById]);

  const selectedClan = useMemo(
    () => rankedClans.find((clan) => clan.id === selectedClanId),
    [rankedClans, selectedClanId]
  );

  const selectedClanMembers = useMemo(() => {
    if (!selectedClan) {
      return [];
    }

    return [...selectedClan.members].sort((first, second) => {
      const firstIsAdmin = first.role === "admin" ? 1 : 0;
      const secondIsAdmin = second.role === "admin" ? 1 : 0;
      const firstXp = Number(usersById[first.userId]?.xp || 0);
      const secondXp = Number(usersById[second.userId]?.xp || 0);

      return (
        secondIsAdmin - firstIsAdmin ||
        secondXp - firstXp ||
        getDisplayName(usersById[first.userId]).localeCompare(
          getDisplayName(usersById[second.userId])
        )
      );
    });
  }, [selectedClan, usersById]);

  const myClanRank = useMemo(
    () => rankedClans.find((clan) => clan.id === myClan?.id)?.rank,
    [myClan?.id, rankedClans]
  );

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

  const filteredInviteFriends = useMemo(() => {
    const query = friendInviteQuery.trim().toLowerCase();
    if (!query) return friends;

    return friends.filter((friend) => {
      const displayName = getDisplayName(friend).toLowerCase();
      const email = String(friend.username || "").toLowerCase();
      return displayName.includes(query) || email.includes(query);
    });
  }, [friendInviteQuery, friends]);

  const insertClanMember = async (memberRow) => {
    const { error } = await supabase.from("clan_members").insert(memberRow);

    if (
      error &&
      memberRow.role &&
      (error.code === "42703" || error.message?.toLowerCase().includes("role"))
    ) {
      const rowWithoutRole = { ...memberRow };
      delete rowWithoutRole.role;
      return supabase.from("clan_members").insert(rowWithoutRole);
    }

    return { error };
  };

  const openClanDetails = (clanId) => {
    setSelectedClanId(clanId);
    setActiveView("clan-detail");
  };

  const isClanAdmin = (clan) =>
    Boolean(
      clan &&
        (clan.ownerId === currentUserId ||
          clan.members.some(
            (member) =>
              member.userId === currentUserId && member.role === "admin"
          ))
    );

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

    const { error: insertError } = await insertClanMember({
      clan_id: clanId,
      user_id: currentUserId,
      role: "member",
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
    const { error: memberError } = await insertClanMember({
      clan_id: newClan.id,
      user_id: currentUserId,
      role: "admin",
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

  const removeClanMember = async (clan, memberId) => {
    showMessage("");

    if (!isClanAdmin(clan)) {
      showMessage("Only clan admins can remove members.", "error");
      return;
    }

    if (String(memberId) === String(clan.ownerId)) {
      showMessage("The clan owner cannot be removed. Delete the clan instead.", "error");
      return;
    }

    const { error } = await supabase
      .from("clan_members")
      .delete()
      .eq("clan_id", clan.id)
      .eq("user_id", String(memberId));

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    showMessage("Clan member removed.");
    await loadClans();
  };

  const deleteClan = async (clan) => {
    showMessage("");

    if (!isClanAdmin(clan)) {
      showMessage("Only clan admins can delete this clan.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${clan.name}? This removes the clan and all memberships.`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase.from("clans").delete().eq("id", clan.id);

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    setSelectedClanId("");
    setActiveView("clans");
    showMessage(`${clan.name} deleted.`);
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

  const applyDuration = useCallback((days) => {
    setDurationDays(clampDuration(days));
  }, []);

  const adjustDuration = useCallback((change) => {
    setDurationDays((currentDays) =>
      clampDuration(Number(currentDays || MIN_DURATION) + change)
    );
  }, []);

  const handleDurationWheel = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    event.nativeEvent?.stopImmediatePropagation?.();
    if (event.deltaY === 0) return;
    adjustDuration(event.deltaY < 0 ? 1 : -1);
  }, [adjustDuration]);

  const resetDurationKeyBuffer = useCallback(() => {
    if (durationKeyTimerRef.current) {
      clearTimeout(durationKeyTimerRef.current);
      durationKeyTimerRef.current = null;
    }

    durationKeyBufferRef.current = "";
  }, []);

  const scheduleDurationKeyReset = useCallback(() => {
    if (durationKeyTimerRef.current) {
      clearTimeout(durationKeyTimerRef.current);
    }

    durationKeyTimerRef.current = setTimeout(() => {
      durationKeyBufferRef.current = "";
      durationKeyTimerRef.current = null;
    }, 850);
  }, []);

  const handleDurationKeyDown = useCallback((event) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      event.stopPropagation();

      const typedValue = `${durationKeyBufferRef.current}${event.key}`
        .replace(/^0+/, "")
        .slice(0, 3);
      const nextBuffer = typedValue || "0";
      const requestedDays = Number(nextBuffer);

      durationKeyBufferRef.current = nextBuffer;

      if (requestedDays > MAX_DURATION) {
        applyDuration(MAX_DURATION);
        durationKeyBufferRef.current = String(MAX_DURATION);
      } else if (requestedDays >= MIN_DURATION) {
        applyDuration(requestedDays);
      }

      scheduleDurationKeyReset();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      adjustDuration(1);
      resetDurationKeyBuffer();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      adjustDuration(-1);
      resetDurationKeyBuffer();
      return;
    }

    if (event.key === "Escape") {
      resetDurationKeyBuffer();
    }
  }, [adjustDuration, applyDuration, resetDurationKeyBuffer, scheduleDurationKeyReset]);

  const setDurationWheelNode = useCallback((node) => {
    durationWheelCleanupRef.current?.();
    durationWheelCleanupRef.current = null;
    durationWheelRef.current = node;

    if (!node) {
      return;
    }

    node.addEventListener("wheel", handleDurationWheel, { passive: false });
    durationWheelCleanupRef.current = () => {
      node.removeEventListener("wheel", handleDurationWheel);
    };
  }, [handleDurationWheel]);

  useEffect(
    () => () => {
      durationWheelCleanupRef.current?.();
      durationWheelCleanupRef.current = null;
    },
    []
  );

  useEffect(() => () => resetDurationKeyBuffer(), [resetDurationKeyBuffer]);

  const durationWheelValues = useMemo(() => {
    const values = [];
    for (let offset = -2; offset <= 2; offset += 1) {
      const nextValue = durationDays + offset;
      if (nextValue >= MIN_DURATION && nextValue <= MAX_DURATION) {
        values.push(nextValue);
      }
    }

    return values;
  }, [durationDays]);
  const activeDurationIndex = durationWheelValues.indexOf(durationDays);

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

    const confirmed = window.confirm(
      "Once created, this capsule cannot be manually deleted. If members fail challenges or activity rules, XP may be lost."
    );

    if (!confirmed) {
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
        visibility: capsuleVisibility,
        room_code: generateRoomCode(),
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
    setFriendInviteQuery("");
    setCapsuleVisibility("private");
    setDurationDays(30);
    setIsCreatingCapsule(false);
    showMessage(`Created ${title}. Share the room code or invite friends.`);
    await loadCapsules();
  };

  const joinCapsule = async (capsuleId) => {
    const confirmed = window.confirm(
      "By joining this capsule, you accept that the capsule cannot be manually deleted. If you fail challenges, you may lose XP."
    );

    if (!confirmed) {
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

  const joinCapsuleFromRoomCode = async (capsule) => {
    if (!capsule?.id) {
      return;
    }

    const confirmed = window.confirm(
      "By joining this capsule, you accept that the capsule cannot be manually deleted. If you fail challenges, you may lose XP."
    );

    if (!confirmed) {
      return;
    }

    const joinedAt = new Date().toISOString();
    const { error } = await supabase.from("time_capsule_members").upsert(
      {
        capsule_id: capsule.id,
        user_id: currentUserId,
        invited_by: capsule.ownerId || currentUserId,
        status: "joined",
        joined_at: joinedAt,
      },
      { onConflict: "capsule_id,user_id" }
    );

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    showMessage(`Joined ${capsule.title}.`);
    setRoomCodeResult(null);
    setRoomCodeQuery("");
    await loadCapsules();
  };

  const searchRoomCode = async () => {
    const normalizedCode = normalizeRoomCode(roomCodeQuery);
    setRoomCodeQuery(normalizedCode);
    setRoomCodeResult(null);
    showMessage("");

    if (normalizedCode.length < 4) {
      showMessage("Enter a valid room code.", "error");
      return;
    }

    setIsSearchingRoom(true);

    const { data: capsuleRow, error: capsuleError } = await supabase
      .from("time_capsules")
      .select(
        "id, title, challenge, owner_id, duration_days, visibility, room_code, starts_at, ends_at, created_at"
      )
      .eq("room_code", normalizedCode)
      .maybeSingle();

    if (capsuleError) {
      showMessage(capsuleError.message, "error");
      setIsSearchingRoom(false);
      return;
    }

    if (!capsuleRow) {
      showMessage("No Time Capsule found for that room code.", "error");
      setIsSearchingRoom(false);
      return;
    }

    const { data: memberRows, error: memberError } = await supabase
      .from("time_capsule_members")
      .select("capsule_id, user_id, status, joined_at")
      .eq("capsule_id", capsuleRow.id);

    if (memberError) {
      showMessage(memberError.message, "error");
      setIsSearchingRoom(false);
      return;
    }

    setRoomCodeResult(mapCapsuleRows([capsuleRow], memberRows || [])[0]);
    setIsSearchingRoom(false);
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

  const openCapsuleDashboard = (capsuleId) => {
    navigate(`/time-capsules/${capsuleId}`);
  };

  const startOnlineDuel = () => {
    if (!duelOpponentId) {
      showMessage("Choose one friend for the Online Duel.", "error");
      return;
    }

    const opponent = friends.find(
      (friend) => String(friend.id) === String(duelOpponentId)
    );

    showMessage(
      `Duel War Zone invite prepared for ${getDisplayName(opponent)}. Matchmaking storage will plug in next.`
    );
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
      <article
        className="capsule-card clickable-capsule-card"
        key={capsule.id}
        role="button"
        tabIndex={0}
        onClick={() => openCapsuleDashboard(capsule.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            openCapsuleDashboard(capsule.id);
          }
        }}
      >
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
          <span>{capsule.visibility}</span>
          <span>
            {joinedCount}/{participantCount} joined
          </span>
        </div>
        {capsule.roomCode && (
          <div className="capsule-room-code">
            <span>Room code</span>
            <strong>{capsule.roomCode}</strong>
          </div>
        )}
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
            <button
              className="capsule-primary"
              onClick={(event) => {
                event.stopPropagation();
                joinCapsule(capsule.id);
              }}
            >
              Join challenge
            </button>
            <button
              className="capsule-secondary"
              onClick={(event) => {
                event.stopPropagation();
                declineCapsule(capsule.id);
              }}
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
      </div>

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
              <small>
                {myClan
                  ? `[${myClan.tag}] Rank #${myClanRank || "-"}`
                  : "Choose your team"}
              </small>
            </div>

            <nav className="clan-navigation" aria-label="Clan page sections">
              <button
                className={
                  activeView === "clans" || activeView === "clan-detail"
                    ? "active"
                    : ""
                }
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
                className={activeView === "duel" ? "active" : ""}
                onClick={() => setActiveView("duel")}
              >
                Online Duel
              </button>
            </nav>
          </aside>
        )}

        <main className="clan-main">
          {isLoading && <p className="clan-loading">Loading arena data...</p>}

          {!isLoading && activeView === "capsules" && (
            <>
              <section className="capsule-room-panel">
                <div className="capsule-section-heading">
                  <div>
                    <span className="clan-eyebrow">Room code invite</span>
                    <h2>Find a Capsule</h2>
                  </div>
                </div>
                <div className="capsule-room-search">
                  <input
                    value={roomCodeQuery}
                    placeholder="Enter room code"
                    onChange={(event) =>
                      setRoomCodeQuery(normalizeRoomCode(event.target.value))
                    }
                  />
                  <button type="button" onClick={searchRoomCode}>
                    {isSearchingRoom ? "Searching..." : "Search"}
                  </button>
                </div>
                {roomCodeResult && (
                  <article className="capsule-room-result">
                    <div>
                      <span>{roomCodeResult.visibility}</span>
                      <h3>{roomCodeResult.title}</h3>
                      <p>{roomCodeResult.challenge}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => joinCapsuleFromRoomCode(roomCodeResult)}
                    >
                      Join by code
                    </button>
                  </article>
                )}
              </section>

              <section className="capsule-room-panel capsule-list-section">
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

              <section className="capsule-hero">
                <div>
                  <span className="clan-eyebrow">Commit together</span>
                  <h2>Create a Time Capsule</h2>
                  <p>
                    Invite friends into a fixed learning challenge. Seven days is
                    the minimum; use the day dial to lock anything up to 365 days.
                  </p>
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
                  </div>
                  <div
                    className="duration-scroll"
                    aria-label="Capsule duration"
                  >
                    <button
                      type="button"
                      onClick={() => adjustDuration(1)}
                      aria-label="Increase duration"
                    >
                      ^
                    </button>
                    <div
                      className="duration-wheel"
                      ref={setDurationWheelNode}
                      role="spinbutton"
                      tabIndex={0}
                      aria-label="Type a duration from 7 to 365 days"
                      aria-valuemin={MIN_DURATION}
                      aria-valuemax={MAX_DURATION}
                      aria-valuenow={durationDays}
                      onKeyDown={handleDurationKeyDown}
                    >
                      {durationWheelValues.map((days, index) => {
                        const distance = Math.abs(index - activeDurationIndex);
                        const positionClass =
                          index < activeDurationIndex
                            ? "above"
                            : index > activeDurationIndex
                              ? "below"
                              : "center";

                        return (
                          <button
                            type="button"
                            className={`duration-wheel-item ${positionClass} ${
                              durationDays === days ? "active" : ""
                            } distance-${distance}`}
                            key={days}
                            onClick={() => applyDuration(days)}
                          >
                            {days}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustDuration(-1)}
                      aria-label="Decrease duration"
                    >
                      v
                    </button>
                    <div className="duration-summary">
                      <strong>{durationDays} days</strong>
                    </div>
                  </div>
                </div>

                <div className="capsule-visibility-section">
                  <div className="duration-heading">
                    <span>Access</span>
                    <small>Private uses invites and room code. Public can be joined by code.</small>
                  </div>
                  <div className="capsule-visibility-options">
                    {["private", "public"].map((visibility) => (
                      <button
                        type="button"
                        className={capsuleVisibility === visibility ? "active" : ""}
                        key={visibility}
                        onClick={() => setCapsuleVisibility(visibility)}
                      >
                        <strong>{visibility}</strong>
                        <span>
                          {visibility === "private"
                            ? "Invite first"
                            : "Room-code join"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="friend-invite-section">
                  <div className="duration-heading">
                    <span>Invite friends</span>
                    <small>{selectedFriendIds.length} selected</small>
                  </div>
                  {friends.length === 0 ? (
                    <p className="capsule-empty">
                      Add a friend before creating a Time Capsule.
                    </p>
                  ) : (
                    <>
                      <label className="friend-invite-search">
                        <input
                          value={friendInviteQuery}
                          placeholder="Search by name or email"
                          onChange={(event) =>
                            setFriendInviteQuery(event.target.value)
                          }
                        />
                      </label>
                      {filteredInviteFriends.length === 0 ? (
                        <p className="capsule-empty compact">
                          No friends match that search.
                        </p>
                      ) : (
                        <div className="friend-invite-list">
                          {filteredInviteFriends.map((friend) => {
                            const friendId = String(friend.id);
                            const selected = selectedFriendIds.includes(friendId);

                            return (
                              <label
                                className={selected ? "selected" : ""}
                                key={friend.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleFriend(friend.id)}
                                />
                                <span>{getDisplayName(friend)}</span>
                                <small>{Number(friend.xp || 0)} XP</small>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <p className="capsule-rule-warning">
                  Once created, this capsule cannot be manually deleted. If
                  members fail challenges or activity rules, XP may be lost.
                </p>

                <button
                  className="capsule-create-button"
                  disabled={isCreatingCapsule}
                  onClick={createCapsule}
                >
                  {isCreatingCapsule ? "Sealing capsule..." : "Create Time Capsule"}
                </button>
              </section>
            </>
          )}

          {!isLoading && activeView === "clans" && (
            <section className="clan-list-panel">
              <div className="capsule-section-heading">
                <div>
                  <span className="clan-eyebrow">Find your team</span>
                  <h2>Available Clans</h2>
                </div>
                <strong>{filteredRankedClans.length} found</strong>
              </div>

              <label className="clan-search-field">
                <span>Search clans</span>
                <input
                  value={clanSearchQuery}
                  placeholder="Search by clan, tag, member, or country"
                  onChange={(event) => setClanSearchQuery(event.target.value)}
                />
              </label>

              {filteredRankedClans.length === 0 ? (
                <p className="capsule-empty">
                  No clan matches that search. Try a clan tag, member name, or
                  country.
                </p>
              ) : (
                <div className="clan-card-grid">
                  {filteredRankedClans.map((clan) => {
                  const isJoined = clan.memberIds.includes(currentUserId);
                  return (
                    <article className="side-clan-card" key={clan.id}>
                      <div>
                        <span>[{clan.tag}]</span>
                        <h3>{clan.name}</h3>
                      </div>
                      <strong>Rank #{clan.rank}</strong>
                      <p>
                        {clan.memberCount} members - {clan.totalXp} XP -{" "}
                        {clan.solvedCount} solves
                      </p>
                      <div className="clan-card-actions">
                        <button
                          type="button"
                          onClick={() => openClanDetails(clan.id)}
                        >
                          View clan
                        </button>
                        <button
                          type="button"
                          disabled={isJoined}
                          onClick={() => updateMembership(clan.id)}
                        >
                          {isJoined ? "Current clan" : "Join clan"}
                        </button>
                      </div>
                    </article>
                  );
                  })}
                </div>
              )}
            </section>
          )}

          {!isLoading && activeView === "ranking" && (
            <section className="clan-ranking-panel">
              <div className="capsule-section-heading">
                <div>
                  <span className="clan-eyebrow">Leaderboard</span>
                  <h2>Clan Ranking</h2>
                </div>
              </div>
              <div className="clan-ranking-list">
                {rankedClans.map((clan, index) => (
                  <div key={clan.id}>
                    <strong>#{clan.rank || index + 1}</strong>
                    <span>
                      <b>{clan.name}</b>
                      <small>
                        [{clan.tag}] {clan.memberCount} members -{" "}
                        {clan.solvedCount} solves
                      </small>
                    </span>
                    <b>{clan.totalXp} XP</b>
                    <button
                      type="button"
                      onClick={() => openClanDetails(clan.id)}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isLoading && activeView === "clan-detail" && (
            <section className="clan-detail-panel">
              {!selectedClan ? (
                <>
                  <div className="capsule-section-heading">
                    <div>
                      <span className="clan-eyebrow">Clan not found</span>
                      <h2>Choose another clan</h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="capsule-secondary"
                    onClick={() => setActiveView("clans")}
                  >
                    Back to clans
                  </button>
                </>
              ) : (
                <>
                  <div className="clan-detail-heading">
                    <div>
                      <span className="clan-eyebrow">Clan command center</span>
                      <h2>{selectedClan.name}</h2>
                      <p>
                        [{selectedClan.tag}] led by{" "}
                        {getDisplayName(usersById[selectedClan.ownerId])}
                      </p>
                    </div>
                    <div className="clan-detail-actions">
                      <button
                        type="button"
                        className="capsule-secondary"
                        onClick={() => setActiveView("clans")}
                      >
                        Back
                      </button>
                      {isClanAdmin(selectedClan) && (
                        <button
                          type="button"
                          className="clan-danger-button"
                          onClick={() => deleteClan(selectedClan)}
                        >
                          Delete clan
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="clan-detail-stats">
                    <article>
                      <span>Rank</span>
                      <strong>#{selectedClan.rank}</strong>
                    </article>
                    <article>
                      <span>Total XP</span>
                      <strong>{selectedClan.totalXp}</strong>
                    </article>
                    <article>
                      <span>Solved</span>
                      <strong>{selectedClan.solvedCount}</strong>
                    </article>
                    <article>
                      <span>Members</span>
                      <strong>{selectedClan.memberCount}</strong>
                    </article>
                  </div>

                  <div className="clan-member-list">
                    <div className="capsule-section-heading">
                      <div>
                        <span className="clan-eyebrow">Roster</span>
                        <h3>Members inside this clan</h3>
                      </div>
                    </div>

                    {selectedClanMembers.map((member) => {
                      const profile = usersById[member.userId] || {};
                      const progress = progressByUserId[member.userId] || {};
                      const isOwner = member.userId === selectedClan.ownerId;
                      const canRemove =
                        isClanAdmin(selectedClan) && !isOwner;

                      return (
                        <article className="clan-member-row" key={member.userId}>
                          <div className="clan-member-avatar">
                            {getDisplayName(profile).charAt(0)}
                          </div>
                          <div>
                            <strong>{getDisplayName(profile)}</strong>
                            <small>
                              {profile.country || "Country not set"} -{" "}
                              {isOwner ? "Owner" : member.role}
                            </small>
                          </div>
                          <span>{Number(profile.xp || 0)} XP</span>
                          <span>{Number(progress.solvedCount || 0)} solved</span>
                          {canRemove ? (
                            <button
                              type="button"
                              className="clan-danger-button"
                              onClick={() =>
                                removeClanMember(selectedClan, member.userId)
                              }
                            >
                              Remove
                            </button>
                          ) : (
                            <small className="clan-member-lock">
                              {isOwner ? "Protected" : "Member"}
                            </small>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
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

          {activeView === "duel" && (
            <section className="clan-duel-panel">
              <span className="clan-eyebrow">Two-player arena</span>
              <h2>Online Duel War Zone</h2>
              <p>
                Start a focused head-to-head challenge from Clans. Time Capsules
                stay as group learning commitments; duels live here.
              </p>

              <div className="duel-arena-grid">
                <div className="duel-card current">
                  <span>You</span>
                  <strong>{getDisplayName(currentUser)}</strong>
                  <small>{Number(currentUser.xp || 0)} XP</small>
                </div>
                <div className="duel-versus">VS</div>
                <div className="duel-card">
                  <span>Opponent</span>
                  <strong>
                    {duelOpponentId
                      ? getDisplayName(
                          friends.find(
                            (friend) => String(friend.id) === String(duelOpponentId)
                          )
                        )
                      : "Choose friend"}
                  </strong>
                  <small>Live duel invite</small>
                </div>
              </div>

              <div className="duel-friend-list">
                {friends.length === 0 ? (
                  <p className="capsule-empty">
                    Add friends before starting an online duel.
                  </p>
                ) : (
                  friends.map((friend) => (
                    <button
                      type="button"
                      className={
                        String(friend.id) === String(duelOpponentId) ? "active" : ""
                      }
                      key={friend.id}
                      onClick={() => setDuelOpponentId(String(friend.id))}
                    >
                      <span>{getDisplayName(friend).charAt(0)}</span>
                      <strong>{getDisplayName(friend)}</strong>
                      <small>{Number(friend.xp || 0)} XP</small>
                    </button>
                  ))
                )}
              </div>

              <button className="duel-start-button" onClick={startOnlineDuel}>
                Create duel invite
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const getDisplayName = (user) => user?.uusername || user?.username || "Friend";

const mapClanRows = (clanRows = [], memberRows = []) => {
  return clanRows.map((clan) => ({
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    ownerId: clan.owner_id,
    createdAt: clan.created_at,
    memberIds: memberRows
      .filter((member) => member.clan_id === clan.id)
      .map((member) => member.user_id),
  }));
};

export default function Clan() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));

  const [activeView, setActiveView] = useState("join");
  const [clans, setClans] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [clanName, setClanName] = useState("");
  const [clanTag, setClanTag] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [isLoading, setIsLoading] = useState(true);

  const loadClans = useCallback(async () => {
    setIsLoading(true);

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
      setMessageType("error");
      setMessage((clanError || memberError).message);
      setClans([]);
      setIsLoading(false);
      return;
    }

    setClans(mapClanRows(clanRows || [], memberRows || []));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase
        .from("lusers")
        .select("id, username, uusername, xp");

      const nextUsersById = {};
      (data || []).forEach((user) => {
        nextUsersById[user.id] = user;
      });

      setUsersById(nextUsersById);
    };

    loadClans();
    loadUsers();
  }, [loadClans]);

  const rankedClans = useMemo(() => {
    return clans
      .map((clan) => {
        const memberIds = clan.memberIds || [];
        const totalXp = memberIds.reduce((sum, memberId) => {
          return sum + Number(usersById[memberId]?.xp || 0);
        }, 0);

        return {
          ...clan,
          memberCount: memberIds.length,
          totalXp,
        };
      })
      .sort((a, b) => b.totalXp - a.totalXp || b.memberCount - a.memberCount);
  }, [clans, usersById]);

  const myClan = clans.find((clan) =>
    (clan.memberIds || []).includes(String(currentUser.id))
  );

  const updateMembership = async (clanId) => {
    setMessage("");
    setMessageType("success");

    const { error: deleteError } = await supabase
      .from("clan_members")
      .delete()
      .eq("user_id", String(currentUser.id));

    if (deleteError) {
      setMessageType("error");
      setMessage(deleteError.message);
      return;
    }

    const { error: insertError } = await supabase.from("clan_members").insert({
      clan_id: clanId,
      user_id: String(currentUser.id),
    });

    if (insertError) {
      setMessageType("error");
      setMessage(insertError.message);
      return;
    }

    const selectedClan = clans.find((clan) => clan.id === clanId);
    setMessage(`Joined ${selectedClan?.name || "clan"}`);
    await loadClans();
  };

  const createClan = async () => {
    const name = clanName.trim();
    const tag = clanTag.trim().toUpperCase();

    setMessage("");
    setMessageType("success");

    if (!name || !tag) {
      setMessageType("error");
      setMessage("Clan name and tag are required");
      return;
    }

    if (tag.length < 2 || tag.length > 8) {
      setMessageType("error");
      setMessage("Clan tag must be 2 to 8 characters");
      return;
    }

    const duplicateClan = clans.some(
      (clan) =>
        clan.name.toLowerCase() === name.toLowerCase() ||
        clan.tag.toLowerCase() === tag.toLowerCase()
    );

    if (duplicateClan) {
      setMessageType("error");
      setMessage("A clan with that name or tag already exists");
      return;
    }

    const { data: newClan, error: clanError } = await supabase
      .from("clans")
      .insert({
        name,
        tag,
        owner_id: String(currentUser.id),
      })
      .select("id, name, tag, owner_id, created_at")
      .single();

    if (clanError) {
      setMessageType("error");
      setMessage(clanError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("clan_members")
      .delete()
      .eq("user_id", String(currentUser.id));

    if (deleteError) {
      setMessageType("error");
      setMessage(deleteError.message);
      return;
    }

    const { error: memberError } = await supabase.from("clan_members").insert({
      clan_id: newClan.id,
      user_id: String(currentUser.id),
    });

    if (memberError) {
      setMessageType("error");
      setMessage(memberError.message);
      return;
    }

    setClanName("");
    setClanTag("");
    setActiveView("ranking");
    setMessage(`Created ${name}`);
    await loadClans();
  };

  const getMemberNames = (memberIds = []) => {
    return memberIds
      .map((memberId) => getDisplayName(usersById[memberId]))
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Clans</h1>
          <p>
            {myClan
              ? `Current clan: ${myClan.name} [${myClan.tag}]`
              : "Choose a clan or create one for your friends."}
          </p>
        </div>

        <button onClick={() => navigate("/home")}>Back</button>
      </div>

      <div className="tab-buttons">
        <button
          className={activeView === "join" ? "active-tab" : ""}
          onClick={() => setActiveView("join")}
        >
          Join Clan
        </button>
        <button
          className={activeView === "ranking" ? "active-tab" : ""}
          onClick={() => setActiveView("ranking")}
        >
          Clan Ranking
        </button>
        <button
          className={activeView === "create" ? "active-tab" : ""}
          onClick={() => setActiveView("create")}
        >
          Create Clan
        </button>
      </div>

      {message && <p className={messageType}>{message}</p>}
      {isLoading && <p>Loading clans...</p>}

      {!isLoading && activeView === "join" && (
        <>
          {rankedClans.length === 0 ? (
            <p className="empty-state">No clans yet. Create the first one.</p>
          ) : (
            <div className="clan-grid">
              {rankedClans.map((clan) => {
                const isJoined = (clan.memberIds || []).includes(
                  String(currentUser.id)
                );
                const memberNames = getMemberNames(clan.memberIds);

                return (
                  <div className="clan-card" key={clan.id}>
                    <div className="clan-card-heading">
                      <div>
                        <h2>{clan.name}</h2>
                        <span>[{clan.tag}]</span>
                      </div>
                      <strong>{clan.totalXp} XP</strong>
                    </div>

                    <p>{clan.memberCount} members</p>
                    <p>{memberNames || "No members yet"}</p>

                    <button
                      className={isJoined ? "btn disabled" : "btn"}
                      disabled={isJoined}
                      onClick={() => updateMembership(clan.id)}
                    >
                      {isJoined ? "Joined" : "Join Clan"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!isLoading && activeView === "ranking" && (
        <>
          {rankedClans.length === 0 ? (
            <p className="empty-state">No clan rankings yet.</p>
          ) : (
            <div className="ranking-list">
              {rankedClans.map((clan, index) => (
                <div className="ranking-row" key={clan.id}>
                  <strong>#{index + 1}</strong>
                  <div>
                    <h3>{clan.name}</h3>
                    <p>
                      [{clan.tag}] {clan.memberCount} members
                    </p>
                  </div>
                  <span>{clan.totalXp} XP</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeView === "create" && (
        <div className="form-panel">
          <h2>Create Clan</h2>

          <input
            className="input"
            value={clanName}
            placeholder="Clan name"
            onChange={(event) => setClanName(event.target.value)}
          />

          <input
            className="input"
            value={clanTag}
            placeholder="Tag"
            maxLength={8}
            onChange={(event) => setClanTag(event.target.value)}
          />

          <button className="btn" onClick={createClan}>
            Create Clan
          </button>
        </div>
      )}
    </div>
  );
}

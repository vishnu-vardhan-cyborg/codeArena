import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { DEMO_PROBLEMS } from "../data/problems";

export default function Home() {
  const navigate = useNavigate();

  const [currentUser] = useState(
    () => JSON.parse(localStorage.getItem("loggedInUser")) || {}
  );

  const [search, setSearch] = useState("");
  const [problemSearch, setProblemSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const debounceTimer = useRef(null);

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  const searchUsers = async (value) => {
    setSearch(value);

    if (!value.trim()) {
      setUsers([]);
      return;
    }

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("lusers")
        .select("*")
        .ilike("username", `%${value}%`)
        .neq("id", currentUser.id);

      let results = data || [];

      if (results.length > 0) {
        const { data: friendRelations } = await supabase
          .from("friends")
          .select("*");

        const currentUserId = String(currentUser.id);

        const friendIds = new Set(
          (friendRelations || [])
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

        results = results.map((user) => ({
          ...user,
          isFriend: friendIds.has(String(user.id)),
        }));
      }

      setUsers(results);
    }, 500);
  };

  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  const sendFriendRequest = async (receiverId) => {
    setMessage("");

    const { data: existing } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("sender_id", currentUser.id)
      .eq("receiver_id", receiverId)
      .in("status", ["pending", "accepted"]);

    if (existing?.length > 0) {
      setMessage("Request already sent");
      return;
    }

    const { error } = await supabase
      .from("friend_requests")
      .insert([
        {
          sender_id: currentUser.id,
          receiver_id: receiverId,
          status: "pending",
        },
      ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Friend request sent");
  };

  const filteredProblems = DEMO_PROBLEMS.filter((problem) => {
    const query = problemSearch.trim().toLowerCase();

    return (
      !query ||
      problem.title.toLowerCase().includes(query) ||
      problem.difficulty.toLowerCase().includes(query)
    );
  });

  return (
    <div className="page">
      <div className="navbar">
        <div>
          <h2>Welcome {currentUser.uusername || currentUser.username}</h2>
          <p>XP: {currentUser.xp || 0}</p>
        </div>

        <div className="nav-buttons">
          <button
            onClick={() => navigate("/notifications")}
          >
            Notifications
          </button>

          <button
            onClick={() => navigate("/clans")}
          >
            Clans
          </button>
          <button 
            onClick={() => navigate("/chat")}
          >
            Chat
          </button>

          <button
            onClick={() => navigate("/profile")}
          >
            Profile
          </button>

          <button onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <section className="problem-browser">
        <div className="section-heading">
          <div>
            <h2>Problems</h2>
            <p>Choose a challenge and start solving.</p>
          </div>

          <span>{filteredProblems.length} problems</span>
        </div>

        <input
          className="problem-search"
          type="search"
          placeholder="Search problems or difficulty"
          value={problemSearch}
          onChange={(event) => setProblemSearch(event.target.value)}
        />

        <div className="problem-list">
          {filteredProblems.length === 0 ? (
            <p className="empty-state">No matching problems.</p>
          ) : (
            filteredProblems.map((problem) => (
              <button
                className="problem-row"
                key={problem.id}
                onClick={() => navigate(`/problems/${problem.id}`)}
              >
                <div>
                  <strong>{problem.title}</strong>
                  <span>Acceptance: {problem.acceptance}</span>
                </div>
                <span
                  className={`difficulty-badge ${problem.difficulty.toLowerCase()}`}
                >
                  {problem.difficulty}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="user-search-section">
        <h2>Find Friends</h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) =>
              searchUsers(e.target.value)
            }
          />
        </div>

        {message && (
          <p className="success">
            {message}
          </p>
        )}

        <div className="users-grid">
          {users.map((user) => (
            <div
              key={user.id}
              className="user-card"
            >
              <h3>{user.uusername || user.username}</h3>
              <p>{user.age ? `Age: ${user.age}` : "Age: N/A"}</p>

              {user.isFriend ? (
                <button className="btn disabled" disabled>
                  Buddy
                </button>
              ) : (
                <button
                  onClick={() =>
                    sendFriendRequest(user.id)
                  }
                >
                  Add Friend
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MapPin,
  MessageCircle,
  RadioTower,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { supabase } from "../supabase";
import "../styles/Profile.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";
const PROFILE_TYPE_LABELS = {
  student: "Student",
  employee: "Employee",
  vibe_coder: "Vibe coder",
};
const TABLE_MISSING_CODES = new Set(["42P01", "PGRST205"]);

const getInitialUser = () => {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch {
    return null;
  }
};

const getRelationIds = (relation) => [
  String(relation.user1_id),
  String(relation.user2_id),
];

export default function PublicProfile() {
  const navigate = useNavigate();
  const { playerId } = useParams();
  const [currentUser] = useState(getInitialUser);
  const currentUserId = currentUser?.id ? String(currentUser.id) : "";
  const targetUserId = playerId ? String(playerId) : "";

  const [profile, setProfile] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    friends: 0,
    posts: 0,
  });
  const [relation, setRelation] = useState({
    isFriend: false,
    isFollowing: false,
    requestPending: false,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPublicProfile = useCallback(async () => {
    if (!targetUserId || !currentUserId) return;

    if (targetUserId === currentUserId) {
      navigate("/profile", { replace: true });
      return;
    }

    setLoading(true);
    setMessage("");

    const profileResult = await supabase
      .from("lusers")
      .select("*")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileResult.error || !profileResult.data) {
      setProfile(null);
      setLoading(false);
      setMessage(profileResult.error?.message || "Player not found");
      return;
    }

    const [
      friendResult,
      followResult,
      followerCountResult,
      followingCountResult,
      requestResult,
      postResult,
      postCountResult,
    ] = await Promise.all([
      supabase.from("friends").select("*"),
      supabase
        .from("user_follows")
        .select("*")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId),
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetUserId),
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", targetUserId),
      supabase
        .from("friend_requests")
        .select("*")
        .eq("sender_id", currentUserId)
        .eq("receiver_id", targetUserId)
        .in("status", ["pending", "accepted"]),
      supabase
        .from("posts")
        .select("*")
        .eq("user_id", targetUserId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", targetUserId)
        .is("archived_at", null),
    ]);

    const friendRows = friendResult.data || [];
    const friendRowsForPlayer = friendRows.filter((friend) =>
      getRelationIds(friend).includes(targetUserId)
    );
    const isFriend = friendRowsForPlayer.some((friend) => {
      const ids = getRelationIds(friend);
      return ids.includes(currentUserId) && ids.includes(targetUserId);
    });

    setProfile(profileResult.data);
    setRecentPosts(TABLE_MISSING_CODES.has(postResult.error?.code) ? [] : postResult.data || []);
    setStats({
      followers: followerCountResult.count || 0,
      following: followingCountResult.count || 0,
      friends: friendRowsForPlayer.length,
      posts: postCountResult.count || 0,
    });
    setRelation({
      isFriend,
      isFollowing: Boolean((followResult.data || []).length),
      requestPending: Boolean((requestResult.data || []).length),
    });
    setLoading(false);
  }, [currentUserId, navigate, targetUserId]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    loadPublicProfile();
  }, [currentUserId, loadPublicProfile, navigate]);

  const displayName = useMemo(
    () => profile?.uusername || profile?.username || "Arena player",
    [profile]
  );

  const sendFriendRequest = async () => {
    setMessage("");

    const { data: existing } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("sender_id", currentUserId)
      .eq("receiver_id", targetUserId)
      .in("status", ["pending", "accepted"]);

    if (existing?.length > 0) {
      setRelation((current) => ({ ...current, requestPending: true }));
      setMessage("Friend request already sent");
      return;
    }

    const { error } = await supabase.from("friend_requests").insert([
      {
        sender_id: currentUserId,
        receiver_id: targetUserId,
        status: "pending",
      },
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRelation((current) => ({ ...current, requestPending: true }));
    setMessage("Friend request sent");
  };

  const toggleFollow = async () => {
    setMessage("");
    const followRelation = {
      follower_id: currentUserId,
      following_id: targetUserId,
    };

    const { error } = relation.isFollowing
      ? await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", followRelation.follower_id)
          .eq("following_id", followRelation.following_id)
      : await supabase.from("user_follows").insert([followRelation]);

    if (error) {
      setMessage(
        TABLE_MISSING_CODES.has(error.code)
          ? "Run backend/social-schema.sql in Supabase to enable following."
          : error.message
      );
      return;
    }

    setRelation((current) => ({
      ...current,
      isFollowing: !current.isFollowing,
    }));
    setStats((current) => ({
      ...current,
      followers: Math.max(
        0,
        current.followers + (relation.isFollowing ? -1 : 1)
      ),
    }));
    setMessage(relation.isFollowing ? "Unfollowed player" : "Following player");
  };

  if (loading) {
    return <p className="profile-loading">Loading player signal...</p>;
  }

  if (!profile) {
    return (
      <div className="page public-profile-page">
        <p className="profile-empty">{message || "Player not found."}</p>
      </div>
    );
  }

  const profileTypeLabel = PROFILE_TYPE_LABELS[profile.profile_type];
  const profileTypeDetail =
    profile.profile_type === "student"
      ? profile.college_name
      : profile.profile_type === "employee"
      ? profile.organization_name
      : "";
  const profileMetaItems = [
    {
      label: "Country",
      value: profile.country || "Country not set",
      icon: <MapPin size={13} />,
    },
    {
      label: "Age",
      value: profile.age ? `Age ${profile.age}` : "Age not set",
    },
    {
      label: "Gender",
      value: profile.gender || "Gender not set",
    },
    profileTypeLabel
      ? {
          label: "Path",
          value: profileTypeDetail
            ? `${profileTypeLabel} - ${profileTypeDetail}`
            : profileTypeLabel,
        }
      : null,
  ].filter(Boolean);

  return (
    <div className="page public-profile-page">
      <header className="profile-page-header public-profile-header">
        <div>
          <span className="profile-eyebrow">Player signal</span>
          <h1>{displayName}</h1>
          <p>{profile.bio || "No bio added yet."}</p>
        </div>
      </header>

      {message && <p className="profile-message">{message}</p>}

      <section className="public-profile-card">
        <div className="public-profile-identity">
          <img src={profile.profile_pic || DEFAULT_AVATAR} alt="" />
          <div>
            <span className="profile-eyebrow">Identity</span>
            <h2>{displayName}</h2>
            <div className="public-profile-meta">
              {profileMetaItems.map((item) => (
                <span key={item.label}>
                  <small>{item.label}</small>
                  <strong>
                    {item.icon}
                    {item.value}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="public-profile-stats">
          <article>
            <span>XP</span>
            <strong>{Number(profile.xp || 0)}</strong>
          </article>
          <article>
            <span>Followers</span>
            <strong>{stats.followers}</strong>
          </article>
          <article>
            <span>Friends</span>
            <strong>{stats.friends}</strong>
          </article>
          <article>
            <span>Posts</span>
            <strong>{stats.posts}</strong>
          </article>
        </div>

        <div className="public-profile-actions">
          <button
            className={relation.isFollowing ? "following" : ""}
            type="button"
            onClick={toggleFollow}
          >
            {relation.isFollowing ? (
              <UserMinus size={17} />
            ) : (
              <RadioTower size={17} />
            )}
            {relation.isFollowing ? "Unfollow" : "Follow"}
          </button>
          <button
            type="button"
            disabled={relation.isFriend || relation.requestPending}
            onClick={sendFriendRequest}
          >
            <UserPlus size={17} />
            {relation.isFriend
              ? "Buddy"
              : relation.requestPending
              ? "Request sent"
              : "Add friend"}
          </button>
          {relation.isFriend && (
            <button type="button" onClick={() => navigate("/chat")}>
              <MessageCircle size={17} />
              Chat
            </button>
          )}
        </div>
      </section>

      <section className="profile-posts-panel public-profile-posts">
        <div className="profile-panel-heading">
          <div>
            <span className="profile-eyebrow">Recent posts</span>
            <h2>Knowledge Drops</h2>
          </div>
          <UsersRound size={20} />
        </div>

        {recentPosts.length === 0 ? (
          <p className="profile-empty">No public posts yet.</p>
        ) : (
          <div className="profile-post-list">
            {recentPosts.map((post) => (
              <article key={post.id}>
                <div className="profile-post-header">
                  <img src={profile.profile_pic || DEFAULT_AVATAR} alt="" />
                  <span>
                    <strong>{displayName}</strong>
                    <small>{new Date(post.created_at).toLocaleString()}</small>
                  </span>
                </div>
                <p>{post.content}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Gamepad2,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../supabase";
import "../styles/Profile.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";
const PROFILE_PICS_BUCKET = "profilepics";
const XP_LEVEL_SIZE = 100;
const CALENDAR_WEEKS = 16;
const SOCIAL_TABLE_MISSING_CODES = new Set(["PGRST205", "42P01"]);
const isRlsError = (error) =>
  error?.message?.toLowerCase().includes("row-level security");

const getProfilePicPath = (url) => {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const marker = `/storage/v1/object/public/${PROFILE_PICS_BUCKET}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const path = parsedUrl.pathname.slice(markerIndex + marker.length);
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
};

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const getCalendarDays = () => {
  const today = startOfDay(new Date());
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - today.getDay()));

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - CALENDAR_WEEKS * 7 + 1);

  return Array.from({ length: CALENDAR_WEEKS * 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
};

const calculateStreak = (activityByDate) => {
  let cursor = startOfDay(new Date());

  if (!activityByDate[getDateKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (activityByDate[getDateKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const getActivityLevel = (count) => {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
};

export default function Profile() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInUser") || "null");
    } catch {
      return null;
    }
  });
  const currentUserId = currentUser?.id ? String(currentUser.id) : "";

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [networkView, setNetworkView] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postView, setPostView] = useState("active");
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postActionId, setPostActionId] = useState("");
  const [editedName, setEditedName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [activitySetupMissing, setActivitySetupMissing] = useState(false);
  const [socialSetupMissing, setSocialSetupMissing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!currentUser?.id) return;

    const { data, error } = await supabase
      .from("lusers")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    setProfile(data);
    setEditedName(data?.uusername || "");
    setEditMode(false);
  }, [currentUser?.id]);

  const loadFriends = useCallback(async () => {
    if (!currentUserId) return;

    const [
      { data: relations, error: relationError },
      { data: users, error: userError },
    ] = await Promise.all([
      supabase.from("friends").select("*"),
      supabase.from("lusers").select("*"),
    ]);

    if (relationError || userError) {
      return;
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

    setFriends((users || []).filter((user) => friendIds.has(String(user.id))));
  }, [currentUserId]);

  const loadActivity = useCallback(async () => {
    if (!currentUserId) return;

    const calendarDays = getCalendarDays();
    const { data, error } = await supabase
      .from("user_activity")
      .select("id, activity_type, problem_id, activity_date, metadata, created_at")
      .eq("user_id", currentUserId)
      .gte("activity_date", getDateKey(calendarDays[0]))
      .order("activity_date", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") {
        setActivitySetupMissing(true);
      }
      return;
    }

    setActivitySetupMissing(false);
    setActivity(data || []);
  }, [currentUserId]);

  const loadSocial = useCallback(async () => {
    if (!currentUserId) return;

    const [
      { data: followRelations, error: followError },
      { data: postData, error: postError },
    ] = await Promise.all([
      supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", currentUserId),
      supabase
        .from("posts")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false }),
    ]);

    if (followError || postError) {
      if (
        SOCIAL_TABLE_MISSING_CODES.has(followError?.code) ||
        SOCIAL_TABLE_MISSING_CODES.has(postError?.code)
      ) {
        setSocialSetupMissing(true);
      }
      return;
    }

    const followerIds = [
      ...new Set((followRelations || []).map((item) => String(item.follower_id))),
    ];

    let followerProfiles = [];
    if (followerIds.length > 0) {
      const { data, error } = await supabase
        .from("lusers")
        .select("*")
        .in("id", followerIds);

      if (!error) {
        followerProfiles = data || [];
      }
    }

    setFollowers(followerProfiles);
    setPosts(postData || []);
    setSocialSetupMissing(false);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    loadProfile();
    loadFriends();
    loadActivity();
    loadSocial();
  }, [
    currentUserId,
    loadActivity,
    loadFriends,
    loadProfile,
    loadSocial,
    navigate,
  ]);

  useEffect(() => {
    if (!profile || window.location.hash !== "#posts") return;

    requestAnimationFrame(() => {
      document.getElementById("posts")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPostModalOpen(true);
    });
  }, [profile]);

  useEffect(() => {
    if (!postModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPostModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [postModalOpen]);

  const calendarDays = useMemo(getCalendarDays, []);

  const activityByDate = useMemo(
    () =>
      activity.reduce((counts, item) => {
        const dateKey = item.activity_date;
        counts[dateKey] = (counts[dateKey] || 0) + 1;
        return counts;
      }, {}),
    [activity]
  );

  const uniqueProblems = useMemo(
    () => new Set(activity.map((item) => item.problem_id).filter(Boolean)).size,
    [activity]
  );

  const currentStreak = calculateStreak(activityByDate);
  const activeDays = Object.keys(activityByDate).length;
  const longestStreak = useMemo(() => {
    let longest = 0;
    let current = 0;

    calendarDays.forEach((date) => {
      if (activityByDate[getDateKey(date)]) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    });

    return longest;
  }, [activityByDate, calendarDays]);

  const monthLabels = useMemo(() => {
    const labels = [];
    let previousMonth = -1;

    calendarDays.forEach((date, index) => {
      if (index % 7 === 0 && date.getMonth() !== previousMonth) {
        labels.push({
          column: Math.floor(index / 7) + 1,
          label: date.toLocaleDateString([], { month: "short" }),
        });
        previousMonth = date.getMonth();
      }
    });

    return labels;
  }, [calendarDays]);

  const handleNameUpdate = async () => {
    const newName = editedName.trim();
    setMessage("");

    if (!newName || newName === profile.uusername) {
      setMessageType("error");
      setMessage(!newName ? "Name cannot be empty" : "Name is unchanged");
      return;
    }

    const { data: existingName } = await supabase
      .from("lusers")
      .select("*")
      .eq("uusername", newName)
      .neq("id", currentUser.id)
      .maybeSingle();

    if (existingName) {
      setMessageType("error");
      setMessage("Name already exists");
      return;
    }

    const { data, error } = await supabase
      .from("lusers")
      .update({ uusername: newName })
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    setProfile(data);
    setEditMode(false);
    localStorage.setItem(
      "loggedInUser",
      JSON.stringify({ ...currentUser, uusername: data.uusername })
    );
    setMessageType("success");
    setMessage("Player name updated");
  };

  const handleProfilePicUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      setMessageType("error");
      setMessage("Please upload a valid image file");
      return;
    }

    setUploading(true);
    setMessage("");
    const extension = file.name.split(".").pop() || "jpg";
    const filePath = `${currentUser.id}/${Date.now()}.${extension}`;
    const previousPicPath = getProfilePicPath(profile.profile_pic);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PROFILE_PICS_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      event.target.value = "";
      setUploading(false);
      setMessageType("error");
      setMessage(
        isRlsError(uploadError)
          ? "Profile picture upload is blocked by Supabase Storage policies. Run backend/profile-pics-storage-schema.sql."
          : uploadError.message
      );
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_PICS_BUCKET)
      .getPublicUrl(uploadData.path);
    const profileUrl = publicUrlData?.publicUrl;

    const { data, error } = await supabase
      .from("lusers")
      .update({ profile_pic: profileUrl })
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) {
      await supabase.storage.from(PROFILE_PICS_BUCKET).remove([uploadData.path]);
      event.target.value = "";
      setUploading(false);
      setMessageType("error");
      setMessage(
        isRlsError(error)
          ? "The profile image uploaded, but updating lusers.profile_pic is blocked by its Supabase policy."
          : error.message
      );
      return;
    }

    if (previousPicPath && previousPicPath !== uploadData.path) {
      await supabase.storage.from(PROFILE_PICS_BUCKET).remove([previousPicPath]);
    }

    event.target.value = "";
    setUploading(false);
    setProfile(data);
    localStorage.setItem(
      "loggedInUser",
      JSON.stringify({ ...currentUser, profile_pic: profileUrl })
    );
    setMessageType("success");
    setMessage("Profile picture updated");
  };

  const createPost = async () => {
    const content = postContent.trim();
    setMessage("");

    if (!content) {
      setMessageType("error");
      setMessage("Write something valuable before sharing.");
      return;
    }

    if (content.length > 2000) {
      setMessageType("error");
      setMessage("Posts can contain up to 2,000 characters.");
      return;
    }

    setIsPosting(true);
    const { data, error } = await supabase
      .from("posts")
      .insert([{ user_id: currentUserId, content }])
      .select("*")
      .single();
    setIsPosting(false);

    if (error) {
      if (SOCIAL_TABLE_MISSING_CODES.has(error.code)) {
        setSocialSetupMissing(true);
      }
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    setPosts((existingPosts) => [data, ...existingPosts]);
    setPostContent("");
    setPostModalOpen(false);
    setMessageType("success");
    setMessage("Post shared with your network.");
  };

  const archivePost = async (post, shouldArchive) => {
    setPostActionId(post.id);
    setMessage("");

    const archivedAt = shouldArchive ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from("posts")
      .update({ archived_at: archivedAt, updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("user_id", currentUserId)
      .select("*")
      .single();

    setPostActionId("");

    if (error) {
      setMessageType("error");
      setMessage(
        error.code === "PGRST204"
          ? "Run backend/social-schema.sql in Supabase to enable post archiving."
          : error.message
      );
      return;
    }

    setPosts((existingPosts) =>
      existingPosts.map((existingPost) =>
        existingPost.id === post.id ? data : existingPost
      )
    );
    setMessageType("success");
    setMessage(shouldArchive ? "Post archived." : "Post restored.");
  };

  const deletePost = async (post) => {
    if (!window.confirm("Delete this post permanently?")) return;

    setPostActionId(post.id);
    setMessage("");

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id)
      .eq("user_id", currentUserId);

    setPostActionId("");

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    setPosts((existingPosts) =>
      existingPosts.filter((existingPost) => existingPost.id !== post.id)
    );
    setMessageType("success");
    setMessage("Post deleted.");
  };

  if (!profile) {
    return <p className="profile-loading">Loading player profile...</p>;
  }

  const xpValue = Number(profile.xp || 0);
  const level = Math.floor(xpValue / XP_LEVEL_SIZE) + 1;
  const levelXp = xpValue % XP_LEVEL_SIZE;
  const progress = Math.min(100, (levelXp / XP_LEVEL_SIZE) * 100);
  const visiblePosts = posts.filter((post) =>
    postView === "archived" ? Boolean(post.archived_at) : !post.archived_at
  );

  return (
    <div className="page profile-page">
      <header className="profile-page-header">
        <div>
          <span className="profile-eyebrow">Player dashboard</span>
          <h1>Profile & Progress</h1>
          <p>Your coding consistency, rank progress, and connections.</p>
        </div>
        <button className="profile-back-button" onClick={() => navigate("/home")}>
          Back
        </button>
      </header>

      {message && <p className={`profile-message ${messageType}`}>{message}</p>}

      <div className="profile-layout">
        <aside className="profile-identity-panel">
          <div className="profile-avatar-wrap">
            <img
              src={profile.profile_pic || DEFAULT_AVATAR}
              alt="Profile"
              className="profile-dashboard-avatar"
            />
            <span>LVL {level}</span>
          </div>

          <label className={`profile-upload ${uploading ? "disabled" : ""}`}>
            {uploading ? "Uploading..." : "Change avatar"}
            <input
              type="file"
              accept="image/*"
              onChange={handleProfilePicUpload}
              disabled={uploading}
            />
          </label>

          {!editMode ? (
            <div className="profile-name-block">
              <h2>{profile.uusername || profile.username}</h2>
              <button onClick={() => setEditMode(true)}>Edit name</button>
            </div>
          ) : (
            <div className="profile-name-editor">
              <input
                value={editedName}
                onChange={(event) => setEditedName(event.target.value)}
              />
              <div>
                <button onClick={handleNameUpdate}>Save</button>
                <button
                  onClick={() => {
                    setEditedName(profile.uusername || "");
                    setEditMode(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="profile-details">
            <div>
              <span>Email</span>
              <strong>{profile.username}</strong>
            </div>
            <div>
              <span>Age</span>
              <strong>{profile.age ?? "N/A"}</strong>
            </div>
            <button
              className={networkView === "friends" ? "active" : ""}
              type="button"
              onClick={() =>
                setNetworkView((view) => (view === "friends" ? "" : "friends"))
              }
            >
              <span>Friends</span>
              <strong>{friends.length}</strong>
            </button>
            <button
              className={networkView === "followers" ? "active" : ""}
              type="button"
              onClick={() =>
                setNetworkView((view) =>
                  view === "followers" ? "" : "followers"
                )
              }
            >
              <span>Followers</span>
              <strong>{followers.length}</strong>
            </button>
          </div>

          <div className="level-progress">
            <div>
              <span>Level {level}</span>
              <strong>{levelXp}/{XP_LEVEL_SIZE} XP</strong>
            </div>
            <div className="level-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>{XP_LEVEL_SIZE - levelXp} XP until level {level + 1}</small>
          </div>

          <button
            className="profile-loadout-button"
            type="button"
            onClick={() => navigate("/career-loadout")}
          >
            <Gamepad2 size={17} />
            Open Career Loadout
          </button>
        </aside>

        <main className="profile-post-column">
          {networkView && (
            <section className="profile-network-panel">
              <div className="profile-panel-heading">
                <div>
                  <span className="profile-eyebrow">Your network</span>
                  <h2>
                    {networkView === "friends" ? "Friends" : "Followers"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close network panel"
                  title="Close"
                  onClick={() => setNetworkView("")}
                >
                  <X size={17} />
                </button>
              </div>
              {(networkView === "friends" ? friends : followers).length === 0 ? (
                <p className="profile-empty">
                  {networkView === "friends"
                    ? "No friends yet."
                    : "No followers yet."}
                </p>
              ) : (
                <div className="profile-friend-grid">
                  {(networkView === "friends" ? friends : followers).map(
                    (person) => (
                      <article key={person.id}>
                        <img
                          src={person.profile_pic || DEFAULT_AVATAR}
                          alt=""
                        />
                        <span>
                          <strong>{person.uusername || person.username}</strong>
                          <small>{Number(person.xp || 0)} XP</small>
                        </span>
                        {networkView === "friends" && (
                          <button onClick={() => navigate("/chat")}>Chat</button>
                        )}
                      </article>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          <section className="profile-posts-panel" id="posts">
            <div className="profile-panel-heading">
              <div>
                <span className="profile-eyebrow">Share knowledge</span>
                <h2>Posts</h2>
                <p>Your learning notes and useful discoveries.</p>
              </div>
              <button
                className="profile-create-post-button"
                type="button"
                onClick={() => setPostModalOpen(true)}
              >
                <Plus size={16} />
                Post
              </button>
            </div>

            <div className="profile-post-tabs" role="tablist">
              <button
                className={postView === "active" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={postView === "active"}
                onClick={() => setPostView("active")}
              >
                Published
                <span>{posts.filter((post) => !post.archived_at).length}</span>
              </button>
              <button
                className={postView === "archived" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={postView === "archived"}
                onClick={() => setPostView("archived")}
              >
                Archived
                <span>{posts.filter((post) => post.archived_at).length}</span>
              </button>
            </div>

            {socialSetupMissing && (
              <p className="profile-setup-note">
                Run <strong>backend/social-schema.sql</strong> in Supabase to
                enable posts, followers, and social notifications.
              </p>
            )}

            {visiblePosts.length === 0 ? (
              <p className="profile-empty">
                {postView === "archived"
                  ? "No archived posts."
                  : "No posts shared yet."}
              </p>
            ) : (
              <div className="profile-post-list">
                {visiblePosts.map((post) => (
                  <article key={post.id}>
                    <div className="profile-post-header">
                      <img
                        src={profile.profile_pic || DEFAULT_AVATAR}
                        alt=""
                      />
                      <span>
                        <strong>{profile.uusername || profile.username}</strong>
                        <small>
                          {new Date(post.created_at).toLocaleString()}
                        </small>
                      </span>
                      <div className="profile-post-actions">
                        <button
                          type="button"
                          title={
                            post.archived_at ? "Restore post" : "Archive post"
                          }
                          aria-label={
                            post.archived_at ? "Restore post" : "Archive post"
                          }
                          disabled={postActionId === post.id}
                          onClick={() => archivePost(post, !post.archived_at)}
                        >
                          {post.archived_at ? (
                            <RotateCcw size={15} />
                          ) : (
                            <Archive size={15} />
                          )}
                        </button>
                        <button
                          className="delete"
                          type="button"
                          title="Delete post"
                          aria-label="Delete post"
                          disabled={postActionId === post.id}
                          onClick={() => deletePost(post)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <p>{post.content}</p>
                    {post.archived_at && (
                      <small className="profile-archive-time">
                        Archived {new Date(post.archived_at).toLocaleString()}
                      </small>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="profile-progress-panel">
          <section className="profile-stat-grid">
            <article>
              <span>Current streak</span>
              <strong>{currentStreak}</strong>
              <small>days</small>
            </article>
            <article>
              <span>Longest streak</span>
              <strong>{longestStreak}</strong>
              <small>days</small>
            </article>
            <article>
              <span>Active days</span>
              <strong>{activeDays}</strong>
              <small>last {CALENDAR_WEEKS} weeks</small>
            </article>
            <article>
              <span>Problems practiced</span>
              <strong>{uniqueProblems}</strong>
              <small>{activity.length} successful runs</small>
            </article>
          </section>

          <section className="streak-panel">
            <div className="streak-panel-heading">
              <div>
                <span className="profile-eyebrow">Consistency tracker</span>
                <h2>Calendar streak</h2>
                <p>Accepted Typhon submissions add activity to this calendar.</p>
              </div>
              <div className="activity-legend">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map((levelValue) => (
                  <i className={`level-${levelValue}`} key={levelValue} />
                ))}
                <span>More</span>
              </div>
            </div>

            {activitySetupMissing && (
              <p className="profile-setup-note">
                Run <strong>backend/profile-activity-schema.sql</strong> in
                Supabase to start tracking activity.
              </p>
            )}

            <div className="activity-calendar-scroll">
              <div className="activity-calendar">
                <div className="month-labels">
                  {monthLabels.map((month) => (
                    <span
                      key={`${month.label}-${month.column}`}
                      style={{ gridColumn: month.column }}
                    >
                      {month.label}
                    </span>
                  ))}
                </div>
                <div className="weekday-labels">
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                </div>
                <div className="activity-grid">
                  {calendarDays.map((date) => {
                    const dateKey = getDateKey(date);
                    const count = activityByDate[dateKey] || 0;
                    return (
                      <span
                        className={`activity-cell level-${getActivityLevel(count)}`}
                        key={dateKey}
                        title={`${date.toLocaleDateString()}: ${count} successful run${
                          count === 1 ? "" : "s"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {postModalOpen && (
        <div
          className="profile-post-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPostModalOpen(false);
            }
          }}
        >
          <section
            className="profile-post-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-post-modal-title"
          >
            <div className="profile-post-modal-heading">
              <div>
                <span className="profile-eyebrow">Knowledge drop</span>
                <h2 id="profile-post-modal-title">Create a post</h2>
              </div>
              <button
                type="button"
                aria-label="Close post composer"
                title="Close"
                onClick={() => setPostModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="profile-post-composer">
              <textarea
                autoFocus
                maxLength={2000}
                placeholder="Share something useful with your network..."
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
              />
              <div>
                <span>{postContent.length}/2000</span>
                <button type="button" onClick={createPost} disabled={isPosting}>
                  <Send size={15} />
                  {isPosting ? "Sharing..." : "Share post"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

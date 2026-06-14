import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/Profile.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";
const PROFILE_PICS_BUCKET = "profilepics";
const XP_LEVEL_SIZE = 100;
const CALENDAR_WEEKS = 16;

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
  const [activity, setActivity] = useState([]);
  const [editedName, setEditedName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activitySetupMissing, setActivitySetupMissing] = useState(false);

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

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    loadProfile();
    loadFriends();
    loadActivity();
  }, [currentUserId, loadActivity, loadFriends, loadProfile, navigate]);

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
      setMessage(uploadError.message);
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
      setMessage(error.message);
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

  if (!profile) {
    return <p className="profile-loading">Loading player profile...</p>;
  }

  const xpValue = Number(profile.xp || 0);
  const level = Math.floor(xpValue / XP_LEVEL_SIZE) + 1;
  const levelXp = xpValue % XP_LEVEL_SIZE;
  const progress = Math.min(100, (levelXp / XP_LEVEL_SIZE) * 100);

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

          <dl className="profile-details">
            <div>
              <dt>Email</dt>
              <dd>{profile.username}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{profile.age ?? "N/A"}</dd>
            </div>
            <div>
              <dt>Friends</dt>
              <dd>{friends.length}</dd>
            </div>
          </dl>

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
        </aside>

        <main className="profile-progress-main">
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
                <p>Successful Judge0 runs add activity to this calendar.</p>
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

          <section className="profile-friends-panel">
            <div>
              <span className="profile-eyebrow">Your network</span>
              <h2>Friends</h2>
            </div>
            {friends.length === 0 ? (
              <p className="profile-empty">No friends yet.</p>
            ) : (
              <div className="profile-friend-grid">
                {friends.map((friend) => (
                  <article key={friend.id}>
                    <img
                      src={friend.profile_pic || DEFAULT_AVATAR}
                      alt=""
                    />
                    <span>
                      <strong>{friend.uusername || friend.username}</strong>
                      <small>{Number(friend.xp || 0)} XP</small>
                    </span>
                    <button onClick={() => navigate("/chat")}>Chat</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

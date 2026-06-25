import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Compass,
  FileText,
  ImagePlus,
  Save,
  X,
} from "lucide-react";
import CareerLoadoutPanel from "../../../shared/components/CareerLoadoutPanel";
import {
  buildCareerStats,
  buildMomentumPoints,
  buildRadarPoints,
} from "../../careerLoadout/careerStats";
import {
  calculateRollingStreak,
  loadUserProblemStats,
} from "../../problems/api/problemApi";
import { supabase } from "../../../shared/services/supabase";
import { showAppToast } from "../../../shared/utils/appToast";
import "../../../styles/features/CareerLoadout.css";
import "../../../styles/features/Profile.css";

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";
const PROFILE_PICS_BUCKET = "profilepics";
const CALENDAR_WEEKS = 16;
const PROFILE_TYPE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "employee", label: "Employee" },
  { value: "vibe_coder", label: "Vibe coder" },
];
const PROFILE_TYPE_LABELS = PROFILE_TYPE_OPTIONS.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});
const isRlsError = (error) =>
  error?.message?.toLowerCase().includes("row-level security");

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const cropImageToBlob = async (previewUrl, zoom, offset) => {
  const image = await loadImage(previewUrl);
  const size = 512;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;
  context.fillStyle = "#101820";
  context.fillRect(0, 0, size, size);

  const baseScale = Math.max(size / image.width, size / image.height);
  const scale = baseScale * zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const maxOffsetX = Math.max(0, (drawWidth - size) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - size) / 2);
  const drawX = (size - drawWidth) / 2 + (offset.x / 100) * maxOffsetX;
  const drawY = (size - drawHeight) / 2 + (offset.y / 100) * maxOffsetY;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
};

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

const getActivityLevel = (count) => {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
};

const formatSubmissionStatus = (status = "") =>
  String(status || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Pending";

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
  const currentUserSubmissionKey = currentUser?.username || currentUserId;

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [activity, setActivity] = useState([]);
  const [submissionSummary, setSubmissionSummary] = useState({
    total: 0,
    recentProblems: [],
    loading: true,
  });
  const [networkView, setNetworkView] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedBio, setEditedBio] = useState("");
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorSaving, setProfileEditorSaving] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState("");
  const [cropFileName, setCropFileName] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [activitySetupMissing, setActivitySetupMissing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!currentUser?.id) return;

    const { data, error } = await supabase
      .from("lusers")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (error) {
      showAppToast(error.message, "error");
      return;
    }

    setProfile(data);
    setEditedName(data?.uusername || "");
    setEditedBio(data?.bio || "");
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

    try {
      const problemStats = await loadUserProblemStats(currentUserId);
      setActivitySetupMissing(false);
      setActivity(problemStats.activity || []);
    } catch {
      setActivitySetupMissing(true);
      return;
    }
  }, [currentUserId]);

  const loadSocial = useCallback(async () => {
    if (!currentUserId) return;

    const [
      { data: followRelations, error: followError },
      followingResult,
      postCountResult,
    ] = await Promise.all([
      supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", currentUserId),
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", currentUserId),
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUserId),
    ]);

    if (followError) {
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
    setFollowingCount(followingResult.count || 0);
    setPostCount(postCountResult.count || 0);
  }, [currentUserId]);

  const loadSubmissionSummary = useCallback(async () => {
    if (!currentUserSubmissionKey) return;

    setSubmissionSummary((current) => ({
      ...current,
      loading: true,
    }));

    const [countResult, recentResult] = await Promise.all([
      supabase
        .from("problem_submissions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUserSubmissionKey),
      supabase
        .from("problem_submissions")
        .select(
          `
          id,
          problem_id,
          status,
          language,
          runtime_ms,
          created_at,
          problems (
            id,
            title,
            difficulty
          )
        `
        )
        .eq("user_id", currentUserSubmissionKey)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (countResult.error || recentResult.error) {
      setSubmissionSummary({
        total: 0,
        recentProblems: [],
        loading: false,
      });
      return;
    }

    const seenProblems = new Set();
    const recentProblems = [];

    (recentResult.data || []).forEach((submission) => {
      const problemKey =
        submission.problem_id || submission.problems?.id || submission.id;

      if (seenProblems.has(problemKey) || recentProblems.length >= 5) {
        return;
      }

      seenProblems.add(problemKey);
      recentProblems.push(submission);
    });

    setSubmissionSummary({
      total: countResult.count || 0,
      recentProblems,
      loading: false,
    });
  }, [currentUserSubmissionKey]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    loadProfile();
    loadFriends();
    loadActivity();
    loadSocial();
    loadSubmissionSummary();
  }, [
    currentUserId,
    loadActivity,
    loadFriends,
    loadProfile,
    loadSocial,
    loadSubmissionSummary,
    navigate,
  ]);

  useEffect(
    () => () => {
      if (cropPreviewUrl) {
        URL.revokeObjectURL(cropPreviewUrl);
      }
    },
    [cropPreviewUrl]
  );

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

  const currentStreak = calculateRollingStreak(activity);
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

  const resetCrop = () => {
    if (cropPreviewUrl) {
      URL.revokeObjectURL(cropPreviewUrl);
    }
    setCropPreviewUrl("");
    setCropFileName("");
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
  };

  const openProfileEditor = () => {
    setEditedName(profile.uusername || "");
    setEditedBio(profile.bio || "");
    resetCrop();
    setProfileEditorOpen(true);
  };

  const closeProfileEditor = () => {
    if (profileEditorSaving) return;
    resetCrop();
    setProfileEditorOpen(false);
  };

  const handleProfileImageSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAppToast("Please upload a valid image file", "error");
      return;
    }

    if (cropPreviewUrl) {
      URL.revokeObjectURL(cropPreviewUrl);
    }

    setCropPreviewUrl(URL.createObjectURL(file));
    setCropFileName(file.name);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
  };

  const handleProfileSave = async () => {
    const newName = editedName.trim();
    const newBio = editedBio.trim();

    if (!newName) {
      showAppToast("Name cannot be empty", "error");
      return;
    }

    if (newBio.length > 280) {
      showAppToast("Bio must be 280 characters or less", "error");
      return;
    }

    setProfileEditorSaving(true);

    if (newName !== profile.uusername) {
      const { data: existingName } = await supabase
        .from("lusers")
        .select("*")
        .eq("uusername", newName)
        .neq("id", currentUser.id)
        .maybeSingle();

      if (existingName) {
        showAppToast("Name already exists", "error");
        setProfileEditorSaving(false);
        return;
      }
    }

    let uploadedPath = "";
    let profileUrl = profile.profile_pic;
    const previousPicPath = getProfilePicPath(profile.profile_pic);

    if (cropPreviewUrl) {
      let croppedBlob = null;
      try {
        croppedBlob = await cropImageToBlob(
          cropPreviewUrl,
          cropZoom,
          cropOffset
        );
      } catch {
        croppedBlob = null;
      }

      if (!croppedBlob) {
        setProfileEditorSaving(false);
        showAppToast("Could not crop the selected image", "error");
        return;
      }

      uploadedPath = `${currentUser.id}/${Date.now()}-${cropFileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-")}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(PROFILE_PICS_BUCKET)
        .upload(uploadedPath, croppedBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/jpeg",
        });

      if (uploadError) {
        setProfileEditorSaving(false);
        showAppToast(
          isRlsError(uploadError)
            ? "Profile picture upload is blocked by Supabase Storage policies. Run backend/schemas/profile-pics-storage-schema.sql."
            : uploadError.message,
          "error"
        );
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(PROFILE_PICS_BUCKET)
        .getPublicUrl(uploadData.path);
      profileUrl = publicUrlData?.publicUrl;
    }

    const updates = {
      uusername: newName,
      bio: newBio || null,
      profile_pic: profileUrl,
    };

    const { data, error } = await supabase
      .from("lusers")
      .update(updates)
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) {
      if (uploadedPath) {
        await supabase.storage.from(PROFILE_PICS_BUCKET).remove([uploadedPath]);
      }
      setProfileEditorSaving(false);
      showAppToast(
        isRlsError(error)
          ? "Profile update is blocked by the lusers Supabase policy."
          : error.message,
        "error"
      );
      return;
    }

    if (previousPicPath && uploadedPath && previousPicPath !== uploadedPath) {
      await supabase.storage.from(PROFILE_PICS_BUCKET).remove([previousPicPath]);
    }

    setProfileEditorSaving(false);
    setProfile(data);
    setProfileEditorOpen(false);
    resetCrop();
    localStorage.setItem(
      "loggedInUser",
      JSON.stringify({
        ...currentUser,
        uusername: data.uusername,
        profile_pic: data.profile_pic,
        bio: data.bio,
      })
    );
    showAppToast("Profile updated", "success");
  };

  if (!profile) {
    return <p className="profile-loading">Loading player profile...</p>;
  }

  const careerStats = buildCareerStats({
    profile,
    activity,
    friendsCount: friends.length,
    followersCount: followers.length,
    followingCount,
    postsCount: postCount,
  });
  const radarPoints = buildRadarPoints(careerStats.axes);
  const momentumPoints = buildMomentumPoints(careerStats.momentum);
  const identitySlot = (
    <section className="profile-identity-card">
      <div className="profile-identity-main">
        <div className="profile-name-block">
          <span className="profile-eyebrow">Identity</span>
          <h2>{profile.uusername || profile.username}</h2>
          <p>{profile.bio || "No bio added yet."}</p>
        </div>

        <div className="profile-identity-actions">
          <button
            className="profile-loadout-button"
            type="button"
            onClick={openProfileEditor}
          >
            <Camera size={17} />
            Edit profile
          </button>

          <button
            className="profile-secondary-button"
            type="button"
            onClick={() => navigate("/explore")}
          >
            <Compass size={17} />
            Explore
          </button>
        </div>
      </div>

      <div className="profile-details">
        <div>
          <span>Email</span>
          <strong>{profile.username}</strong>
        </div>
        <div>
          <span>Age</span>
          <strong>{profile.age ?? "N/A"}</strong>
        </div>
        <div>
          <span>Gender</span>
          <strong>{profile.gender || "N/A"}</strong>
        </div>
        <div>
          <span>Country</span>
          <strong>{profile.country || "N/A"}</strong>
        </div>
        <div>
          <span>Path</span>
          <strong>{PROFILE_TYPE_LABELS[profile.profile_type] || "N/A"}</strong>
        </div>
        {profile.profile_type === "student" && (
          <div>
            <span>College</span>
            <strong>{profile.college_name || "N/A"}</strong>
          </div>
        )}
        {profile.profile_type === "employee" && (
          <div>
            <span>Organization</span>
            <strong>{profile.organization_name || "N/A"}</strong>
          </div>
        )}
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
            setNetworkView((view) => (view === "followers" ? "" : "followers"))
          }
        >
          <span>Followers</span>
          <strong>{followers.length}</strong>
        </button>
      </div>
    </section>
  );

  return (
    <div className="page profile-page">
      <header className="profile-page-header">
        <div>
          <span className="profile-eyebrow">Live player telemetry</span>
          <h1>Career Loadout</h1>
        </div>
      </header>

      <div className="profile-layout">
        <main className="profile-loadout-column">
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

          <CareerLoadoutPanel
            profile={profile}
            stats={careerStats}
            radarPoints={radarPoints}
            momentumPoints={momentumPoints}
            identitySlot={identitySlot}
          />
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
                Run <strong>backend/schemas/profile-activity-schema.sql</strong> in
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

          <section className="profile-submissions-panel">
            <button
              type="button"
              className="profile-submissions-total"
              onClick={() => navigate("/submissions")}
            >
              <span>
                <FileText size={16} />
                Total submissions
              </span>
              <strong>{submissionSummary.total}</strong>
              <small>Open submissions page</small>
            </button>

            <div className="profile-recent-submissions">
              <div className="profile-panel-heading">
                <div>
                  <span className="profile-eyebrow">Latest attempts</span>
                  <h2>Recents</h2>
                </div>
              </div>

              {submissionSummary.loading ? (
                <p className="profile-empty">Loading recent submissions...</p>
              ) : submissionSummary.recentProblems.length === 0 ? (
                <p className="profile-empty">No submissions yet.</p>
              ) : (
                <div className="profile-submission-list">
                  {submissionSummary.recentProblems.map((submission) => (
                    <button
                      type="button"
                      key={submission.id}
                      onClick={() => navigate(`/submissions/${submission.id}`)}
                    >
                      <span>
                        <strong>
                          {submission.problems?.title || "Untitled problem"}
                        </strong>
                        <small>
                          {submission.language || "Unknown language"} -{" "}
                          {new Date(submission.created_at).toLocaleDateString()}
                        </small>
                      </span>
                      <b>{formatSubmissionStatus(submission.status)}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {profileEditorOpen && (
        <div className="profile-editor-backdrop" role="presentation">
          <section
            className="profile-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-editor-title"
          >
            <div className="profile-editor-heading">
              <div>
                <span className="profile-eyebrow">Player identity</span>
                <h2 id="profile-editor-title">Edit profile</h2>
              </div>
              <button
                type="button"
                aria-label="Close profile editor"
                onClick={closeProfileEditor}
                disabled={profileEditorSaving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="profile-editor-grid">
              <div className="profile-crop-panel">
                <div className="profile-crop-frame">
                  {cropPreviewUrl ? (
                    <img
                      src={cropPreviewUrl}
                      alt=""
                      style={{
                        transform: `translate(${cropOffset.x * 0.35}%, ${
                          cropOffset.y * 0.35
                        }%) scale(${cropZoom})`,
                      }}
                    />
                  ) : (
                    <img src={profile.profile_pic || DEFAULT_AVATAR} alt="" />
                  )}
                </div>

                <label className="profile-image-picker">
                  <ImagePlus size={17} />
                  Choose image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageSelect}
                    disabled={profileEditorSaving}
                  />
                </label>

                {cropPreviewUrl && (
                  <div className="profile-crop-controls">
                    <label>
                      <span>Zoom</span>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={cropZoom}
                        onChange={(event) =>
                          setCropZoom(Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>Horizontal</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={cropOffset.x}
                        onChange={(event) =>
                          setCropOffset((current) => ({
                            ...current,
                            x: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Vertical</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={cropOffset.y}
                        onChange={(event) =>
                          setCropOffset((current) => ({
                            ...current,
                            y: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="profile-editor-fields">
                <label className="profile-editor-field">
                  <span>Player name</span>
                  <input
                    value={editedName}
                    onChange={(event) => setEditedName(event.target.value)}
                    disabled={profileEditorSaving}
                  />
                </label>

                <label className="profile-editor-field">
                  <span>Bio</span>
                  <textarea
                    maxLength="280"
                    value={editedBio}
                    onChange={(event) => setEditedBio(event.target.value)}
                    placeholder="Tell players what you are building toward."
                    disabled={profileEditorSaving}
                  />
                  <small>{editedBio.length}/280</small>
                </label>
              </div>
            </div>

            <div className="profile-editor-actions">
              <button
                type="button"
                onClick={closeProfileEditor}
                disabled={profileEditorSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={profileEditorSaving}
              >
                <Save size={17} />
                {profileEditorSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accessibility,
  AlertTriangle,
  Bell,
  Bot,
  BookOpen,
  Code2,
  CreditCard,
  Database,
  Download,
  Eye,
  Globe,
  History,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  Palette,
  PlugZap,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Trophy,
  UserCog,
  X,
} from "lucide-react";
import { COUNTRIES } from "../../../shared/data/countries";
import { supabase } from "../../../shared/services/supabase";
import { showAppToast } from "../../../shared/utils/appToast";
import "../../../styles/features/Settings.css";

const SETTINGS_STORAGE_PREFIX = "codeArena:userSettings";
const SESSION_STORAGE_PREFIX = "codeArena:securitySessions";
const DEVICE_ID_KEY = "codeArena:deviceId";
const TABLE_MISSING_CODES = new Set(["42P01", "PGRST205"]);
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const PROBLEM_CATEGORIES = [
  "Arrays",
  "Strings",
  "Linked List",
  "Trees",
  "Graphs",
  "Dynamic Programming",
  "SQL",
  "System Design",
  "Java",
  "React",
  "Backend",
];

const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"];
const PROFILE_TYPE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "employee", label: "Employee" },
  { value: "vibe_coder", label: "Vibe coder" },
];

const SECTION_CONFIG = [
  { id: "account", label: "Account", icon: UserCog },
  { id: "security", label: "Security", icon: Shield },
  { id: "privacy", label: "Data & Privacy", icon: Database },
  { id: "coding", label: "Coding", icon: Code2, badge: "Coming soon" },
  { id: "problems", label: "Problems", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "contests", label: "Contests", icon: Trophy },
  { id: "visibility", label: "Ranking", icon: Eye },
  { id: "blogs", label: "Blog", icon: BookOpen },
  { id: "integrations", label: "Integrations", icon: PlugZap, badge: "Coming soon" },
  { id: "billing", label: "Billing", icon: CreditCard, badge: "Later" },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "ai", label: "AI Assistant", icon: Bot, badge: "Future" },
];

const DEFAULT_SETTINGS = {
  security: {
    twoFactorEnabled: false,
    suspiciousLoginAlerts: true,
    loginHistoryEnabled: true,
  },
  privacy: {
    profileVisibility: "Public",
    hideSolvedProblems: false,
    hideRank: false,
    hideSubmissions: false,
  },
  coding: {
    defaultLanguage: "python",
    editorTheme: "Dark",
    fontSize: 14,
    tabSize: 2,
    autoSaveCode: true,
    autoRunSamples: false,
    autocomplete: true,
    aiHints: false,
    showBoilerplate: true,
    keyboardShortcuts: "Default",
  },
  problems: {
    difficultyPreference: "All",
    showHints: true,
    showTags: true,
    showCompanyTags: false,
    showAcceptanceRate: true,
    solutionAfterSolvingOnly: true,
    preferredCategories: ["Arrays", "Strings"],
    dailyChallengeReminder: true,
  },
  notifications: {
    emailNotifications: true,
    contestReminders: true,
    contestReminderOffset: "30 minutes",
    dailyChallengeReminders: true,
    dailyChallengeTime: "20:00",
    friendRequests: true,
    rankChanges: true,
    streakReminders: true,
    submissionResults: true,
    blogComments: true,
    newsletter: false,
  },
  contests: {
    reminderTime: "30 minutes",
    defaultLanguage: "python",
    showLiveLeaderboard: true,
    hideLeaderboardDuringContest: false,
    virtualContestMode: true,
    autoSubmitBeforeTimerEnds: false,
    practiceAfterContest: true,
  },
  visibility: {
    globalRank: "Public",
    collegeRank: "Public",
    countryRank: "Public",
    solvedCount: "Public",
    contestRating: "Public",
    badges: "Public",
    streak: "Public",
    blogs: "Public",
    submissions: "Private",
  },
  blogs: {
    defaultVisibility: "Public",
    allowComments: true,
    allowLikes: true,
    showOnProfile: true,
    markdownEditor: true,
    autoSaveDrafts: true,
    aiGrammarSuggestions: false,
    aiBlogSummary: false,
  },
  integrations: {
    github: false,
    googleCalendar: false,
    leetcode: false,
    codeforces: false,
    hackerRank: false,
    linkedIn: false,
    discord: false,
    googleAccount: false,
  },
  billing: {
    currentPlan: "Free",
    aiCreditsUsage: "0 / 0",
  },
  accessibility: {
    colorMode: "Dark",
    highContrast: false,
    fontSize: "Default",
    dyslexiaFriendlyFont: false,
    keyboardNavigation: true,
  },
  appearance: {
    theme: "Dark",
    accentColor: "Silver",
    dashboardLayout: "Standard",
    compactMode: false,
    sidebarCollapsed: false,
    editorLayout: "Split",
  },
  ai: {
    hints: false,
    codeReview: false,
    explanation: false,
    debugging: false,
    difficultyLevel: "Balanced",
    saveChatHistory: false,
    canAccessSubmissions: false,
    canAccessProgress: false,
    canGenerateHintsBeforeSolution: false,
  },
};

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const mergeDeep = (base, override) => {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return base;
  }

  return Object.entries(base).reduce((merged, [key, value]) => {
    const overrideValue = override[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      overrideValue &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue)
    ) {
      merged[key] = mergeDeep(value, overrideValue);
    } else if (overrideValue !== undefined) {
      merged[key] = overrideValue;
    } else {
      merged[key] = value;
    }

    return merged;
  }, {});
};

const isMissingTable = (error) =>
  TABLE_MISSING_CODES.has(error?.code) ||
  error?.message?.toLowerCase().includes("could not find the table");

const getSettingsStorageKey = (userId) => `${SETTINGS_STORAGE_PREFIX}:${userId}`;
const getSessionStorageKey = (userId) => `${SESSION_STORAGE_PREFIX}:${userId}`;

const getUserIdentifiers = (user = {}) =>
  [
    user.id !== undefined && user.id !== null ? String(user.id) : "",
    user.username ? String(user.username) : "",
  ].filter((value, index, values) => value && values.indexOf(value) === index);

const getBrowserName = (userAgent = "") => {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Browser";
};

const getOperatingSystem = (userAgent = "") => {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/mac os|macintosh/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Unknown OS";
};

const getDeviceType = (userAgent = "") =>
  /android|iphone|ipad|mobile/i.test(userAgent) ? "Mobile device" : "Desktop";

const getDeviceId = () => {
  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (existingDeviceId) return existingDeviceId;

  const nextDeviceId =
    window.crypto?.randomUUID?.() ||
    `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  localStorage.setItem(DEVICE_ID_KEY, nextDeviceId);
  return nextDeviceId;
};

const ensureCurrentSession = (user) => {
  const userId = user?.id ? String(user.id) : "";
  if (!userId) return [];

  const storageKey = getSessionStorageKey(userId);
  const deviceId = getDeviceId();
  const userAgent = navigator.userAgent || "";
  const browser = getBrowserName(userAgent);
  const os = getOperatingSystem(userAgent);
  const now = new Date().toISOString();
  const existingSessions = readJson(storageKey, []);
  const currentSession = {
    id: deviceId,
    deviceName: `${browser} on ${os}`,
    browser,
    operatingSystem: os,
    deviceType: getDeviceType(userAgent),
    ipAddress: "Not captured",
    approximateLocation: user.country || "Location unavailable",
    lastActiveAt: now,
    current: true,
  };

  const nextSessions = [
    currentSession,
    ...existingSessions
      .filter((session) => session.id !== deviceId)
      .map((session) => ({ ...session, current: false })),
  ].slice(0, 10);

  writeJson(storageKey, nextSessions);
  return nextSessions;
};

const formatRelativeTime = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

function SettingToggle({ label, detail, checked, disabled, onChange }) {
  return (
    <label className={`settings-toggle ${disabled ? "disabled" : ""}`}>
      <span>
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true">
        <b />
      </i>
    </label>
  );
}

function SettingField({
  label,
  children,
  detail,
  className = "",
}) {
  return (
    <label className={`settings-field ${className}`}>
      <span>{label}</span>
      {children}
      {detail && <small>{detail}</small>}
    </label>
  );
}

function SettingSelect({ label, value, options, disabled, onChange }) {
  return (
    <SettingField label={label}>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </SettingField>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() =>
    readJson("loggedInUser", null)
  );
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = useState("account");
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsSetupMissing, setSettingsSetupMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [accountForm, setAccountForm] = useState({
    country: "India",
    gender: "",
    profileType: "",
    collegeName: "",
    organizationName: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerInput, setDangerInput] = useState("");
  const [dangerRunning, setDangerRunning] = useState(false);

  const currentUserId = currentUser?.id ? String(currentUser.id) : "";
  const storageKey = currentUserId ? getSettingsStorageKey(currentUserId) : "";
  const userIdentifiers = useMemo(
    () => getUserIdentifiers(profile || currentUser || {}),
    [currentUser, profile]
  );
  const countryOptions =
    accountForm.country && !COUNTRIES.includes(accountForm.country)
      ? [accountForm.country, ...COUNTRIES]
      : COUNTRIES;

  const persistSettings = useCallback(
    async (nextSettings) => {
      if (!currentUserId || !storageKey) return;

      writeJson(storageKey, nextSettings);
      setSaving(true);

      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: currentUserId,
          preferences: nextSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        if (isMissingTable(error)) {
          setSettingsSetupMissing(true);
        } else {
          showAppToast(error.message, "error");
        }
      } else {
        setSettingsSetupMissing(false);
      }

      setSaving(false);
    },
    [currentUserId, storageKey]
  );

  const updatePreference = useCallback(
    (section, key, value) => {
      let nextSettings = DEFAULT_SETTINGS;

      setSettings((current) => {
        nextSettings = {
          ...current,
          [section]: {
            ...current[section],
            [key]: value,
          },
        };
        return nextSettings;
      });

      persistSettings(nextSettings);
    },
    [persistSettings]
  );

  const updateCategory = (category) => {
    const existing = settings.problems.preferredCategories;
    const nextCategories = existing.includes(category)
      ? existing.filter((item) => item !== category)
      : [...existing, category];

    updatePreference("problems", "preferredCategories", nextCategories);
  };

  const logoutLocalUser = useCallback(() => {
    const savedTheme = localStorage.getItem("codeArenaTheme");
    localStorage.clear();
    if (savedTheme) {
      localStorage.setItem("codeArenaTheme", savedTheme);
    }
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      setSettingsReady(false);
      const storedUser = readJson("loggedInUser", null);

      const [profileResult, settingsResult] = await Promise.all([
        supabase.from("lusers").select("*").eq("id", storedUser.id).maybeSingle(),
        supabase
          .from("user_settings")
          .select("preferences")
          .eq("user_id", currentUserId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const nextProfile = profileResult.data || storedUser;
      const localSettings = readJson(storageKey, {});
      const remoteSettings = settingsResult.data?.preferences || null;
      const nextSettings = mergeDeep(
        DEFAULT_SETTINGS,
        remoteSettings || localSettings
      );

      if (settingsResult.error && isMissingTable(settingsResult.error)) {
        setSettingsSetupMissing(true);
      } else if (settingsResult.error) {
        showAppToast(settingsResult.error.message, "error");
      }

      setProfile(nextProfile);
      setCurrentUser((existing) => ({ ...existing, ...nextProfile }));
      setAccountForm({
        country: nextProfile.country || "India",
        gender: nextProfile.gender || "",
        profileType: nextProfile.profile_type || "",
        collegeName: nextProfile.college_name || "",
        organizationName: nextProfile.organization_name || "",
      });
      setSettings(nextSettings);
      writeJson(storageKey, nextSettings);
      setSessions(ensureCurrentSession(nextProfile));
      setSettingsReady(true);
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUserId, navigate, storageKey]);

  const saveAccount = async (event) => {
    event.preventDefault();

    const nextCountry = accountForm.country.trim();
    const nextGender = accountForm.gender.trim();
    const nextProfileType = accountForm.profileType.trim();
    const nextCollegeName = accountForm.collegeName.trim();
    const nextOrganizationName = accountForm.organizationName.trim();

    if (!nextCountry) {
      showAppToast("Choose a country.", "error");
      return;
    }

    if (nextGender && !GENDER_OPTIONS.includes(nextGender)) {
      showAppToast("Choose a valid gender option.", "error");
      return;
    }

    if (
      nextProfileType &&
      !PROFILE_TYPE_OPTIONS.some((option) => option.value === nextProfileType)
    ) {
      showAppToast("Choose a valid profile path.", "error");
      return;
    }

    if (nextProfileType === "student" && !nextCollegeName) {
      showAppToast("College name is required for student profiles.", "error");
      return;
    }

    if (nextProfileType === "employee" && !nextOrganizationName) {
      showAppToast("Organization is required for employee profiles.", "error");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("lusers")
      .update({
        country: nextCountry,
        gender: nextGender || null,
        profile_type: nextProfileType || null,
        college_name:
          nextProfileType === "student" ? nextCollegeName || null : null,
        organization_name:
          nextProfileType === "employee" ? nextOrganizationName || null : null,
      })
      .eq("id", currentUser.id)
      .select("*")
      .single();

    if (error) {
      setSaving(false);
      showAppToast(error.message, "error");
      return;
    }

    const nextUser = { ...currentUser, ...data };

    setProfile(data);
    setCurrentUser(nextUser);
    localStorage.setItem("loggedInUser", JSON.stringify(nextUser));
    setSessions(ensureCurrentSession(nextUser));
    setSaving(false);

    showAppToast("Account settings saved.", "success");
  };

  const savePassword = async (event) => {
    event.preventDefault();

    if (passwordForm.currentPassword !== profile.password) {
      showAppToast("Current password is incorrect.", "error");
      return;
    }

    if (!PASSWORD_REGEX.test(passwordForm.newPassword)) {
      showAppToast(
        "Use 8+ characters with uppercase, lowercase, number, and symbol.",
        "error"
      );
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showAppToast("New passwords do not match.", "error");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("lusers")
      .update({ password: passwordForm.newPassword })
      .eq("id", currentUser.id)
      .select("*")
      .single();

    setSaving(false);

    if (error) {
      showAppToast(error.message, "error");
      return;
    }

    const nextUser = { ...currentUser, ...data };
    setProfile(data);
    setCurrentUser(nextUser);
    localStorage.setItem("loggedInUser", JSON.stringify(nextUser));
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    showAppToast("Password changed.");
  };

  const fetchRowsByColumn = async (table, column, values) => {
    const { data, error } = await supabase.from(table).select("*").in(column, values);

    if (error) {
      return {
        rows: [],
        error: isMissingTable(error) ? "Table not installed" : error.message,
      };
    }

    return { rows: data || [], error: "" };
  };

  const fetchRowsByAnyColumn = async (table, columns, values) => {
    const results = await Promise.all(
      columns.map((column) => fetchRowsByColumn(table, column, values))
    );
    const rowsByKey = new Map();
    const errors = [];

    results.forEach((result) => {
      if (result.error && result.error !== "Table not installed") {
        errors.push(result.error);
      }

      result.rows.forEach((row) => {
        rowsByKey.set(row.id || JSON.stringify(row), row);
      });
    });

    return {
      rows: [...rowsByKey.values()],
      error: errors.join("; "),
    };
  };

  const downloadMyData = async () => {
    const profileResult = await supabase
      .from("lusers")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();
    const idValues = currentUserId ? [currentUserId] : [];

    const payload = {
      exported_at: new Date().toISOString(),
      user: profileResult.data || profile || currentUser,
      settings,
      sessions,
      tables: {
        problem_submissions: await fetchRowsByColumn(
          "problem_submissions",
          "user_id",
          userIdentifiers
        ),
        user_problem_progress: await fetchRowsByColumn(
          "user_problem_progress",
          "user_id",
          userIdentifiers
        ),
        user_code_drafts: await fetchRowsByColumn(
          "user_code_drafts",
          "user_id",
          userIdentifiers
        ),
        problem_notes: await fetchRowsByColumn(
          "problem_notes",
          "user_id",
          userIdentifiers
        ),
        user_activity: await fetchRowsByColumn(
          "user_activity",
          "user_id",
          userIdentifiers
        ),
        posts: await fetchRowsByColumn("posts", "user_id", userIdentifiers),
        user_follows: await fetchRowsByAnyColumn(
          "user_follows",
          ["follower_id", "following_id"],
          idValues
        ),
        friend_requests: await fetchRowsByAnyColumn(
          "friend_requests",
          ["sender_id", "receiver_id"],
          idValues
        ),
        social_notifications: await fetchRowsByAnyColumn(
          "social_notifications",
          ["recipient_id", "actor_id"],
          idValues
        ),
        time_capsules: await fetchRowsByColumn(
          "time_capsules",
          "owner_id",
          idValues
        ),
        time_capsule_members: await fetchRowsByColumn(
          "time_capsule_members",
          "user_id",
          idValues
        ),
        time_capsule_messages: await fetchRowsByColumn(
          "time_capsule_messages",
          "sender_id",
          idValues
        ),
        clans: await fetchRowsByColumn("clans", "owner_id", idValues),
        clan_members: await fetchRowsByColumn("clan_members", "user_id", idValues),
        powerups: await fetchRowsByColumn("powerups", "user_id", idValues),
        attacks: await fetchRowsByAnyColumn(
          "attacks",
          ["attacker_id", "target_id"],
          idValues
        ),
        attack_notifications: await fetchRowsByAnyColumn(
          "attack_notifications",
          ["recipient_id", "actor_id"],
          idValues
        ),
        forest_rewards: await fetchRowsByColumn(
          "forest_rewards",
          "user_id",
          idValues
        ),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = String(profile?.username || currentUserId || "player")
      .replace(/[^a-z0-9_-]/gi, "-")
      .toLowerCase();

    link.href = url;
    link.download = `codearena-data-${safeName}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showAppToast("Data export downloaded.");
  };

  const deleteRowsByColumn = async (table, column, values) => {
    if (!values.length) return;

    const { error } = await supabase.from(table).delete().in(column, values);

    if (error && !isMissingTable(error)) {
      throw new Error(`${table}: ${error.message}`);
    }
  };

  const deleteRowsByAnyColumn = async (table, columns, values) => {
    for (const column of columns) {
      await deleteRowsByColumn(table, column, values);
    }
  };

  const openDangerAction = (action) => {
    setDangerAction(action);
    setDangerInput("");
  };

  const closeDangerAction = () => {
    if (dangerRunning) return;
    setDangerAction(null);
    setDangerInput("");
  };

  const executeDangerAction = async () => {
    if (dangerInput !== "DELETE" || !dangerAction) return;

    setDangerRunning(true);

    try {
      if (dangerAction === "submissions") {
        await deleteRowsByColumn("problem_submissions", "user_id", userIdentifiers);
        showAppToast("All submissions deleted.");
      }

      if (dangerAction === "progress") {
        await deleteRowsByColumn("user_problem_progress", "user_id", userIdentifiers);
        await deleteRowsByColumn("user_activity", "user_id", userIdentifiers);
        await deleteRowsByColumn("user_code_drafts", "user_id", userIdentifiers);
        await deleteRowsByColumn("problem_notes", "user_id", userIdentifiers);
        showAppToast("Progress data deleted.");
      }

      if (dangerAction === "account") {
        const idValues = currentUserId ? [currentUserId] : [];

        await deleteRowsByColumn("problem_submissions", "user_id", userIdentifiers);
        await deleteRowsByColumn("user_problem_progress", "user_id", userIdentifiers);
        await deleteRowsByColumn("user_activity", "user_id", userIdentifiers);
        await deleteRowsByColumn("user_code_drafts", "user_id", userIdentifiers);
        await deleteRowsByColumn("problem_notes", "user_id", userIdentifiers);
        await deleteRowsByColumn("posts", "user_id", userIdentifiers);
        await deleteRowsByAnyColumn(
          "user_follows",
          ["follower_id", "following_id"],
          idValues
        );
        await deleteRowsByAnyColumn(
          "friend_requests",
          ["sender_id", "receiver_id"],
          idValues
        );
        await deleteRowsByAnyColumn(
          "social_notifications",
          ["recipient_id", "actor_id"],
          idValues
        );
        await deleteRowsByColumn("time_capsules", "owner_id", idValues);
        await deleteRowsByColumn("time_capsule_members", "user_id", idValues);
        await deleteRowsByColumn("time_capsule_messages", "sender_id", idValues);
        await deleteRowsByColumn("clans", "owner_id", idValues);
        await deleteRowsByColumn("clan_members", "user_id", idValues);
        await deleteRowsByColumn("powerups", "user_id", idValues);
        await deleteRowsByAnyColumn(
          "attacks",
          ["attacker_id", "target_id"],
          idValues
        );
        await deleteRowsByAnyColumn(
          "attack_notifications",
          ["recipient_id", "actor_id"],
          idValues
        );
        await deleteRowsByColumn("forest_rewards", "user_id", idValues);
        await deleteRowsByColumn("user_settings", "user_id", idValues);
        await deleteRowsByColumn("user_login_sessions", "user_id", idValues);

        const { error } = await supabase
          .from("lusers")
          .delete()
          .eq("id", currentUser.id);

        if (error) throw error;

        logoutLocalUser();
        return;
      }

      closeDangerAction();
    } catch (error) {
      showAppToast(error.message || "Delete failed.", "error");
    } finally {
      setDangerRunning(false);
    }
  };

  const logoutSession = (sessionId) => {
    const storageKeyForSessions = getSessionStorageKey(currentUserId);
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    const nextSessions = sessions.filter((session) => session.id !== sessionId);

    writeJson(storageKeyForSessions, nextSessions);
    setSessions(nextSessions);

    if (sessionId === deviceId) {
      logoutLocalUser();
    } else {
      showAppToast("Session removed.");
    }
  };

  const logoutAllSessions = () => {
    localStorage.removeItem(getSessionStorageKey(currentUserId));
    logoutLocalUser();
  };

  const disabledSection = SECTION_CONFIG.find(
    (section) => section.id === activeSection
  )?.badge;
  const activeConfig =
    SECTION_CONFIG.find((section) => section.id === activeSection) ||
    SECTION_CONFIG[0];
  const ActiveIcon = activeConfig.icon;

  const renderAccount = () => (
    <form className="settings-form" onSubmit={saveAccount}>
      <div className="settings-grid two">
        <SettingField label="Country">
          <select
            value={accountForm.country}
            onChange={(event) =>
              setAccountForm((current) => ({
                ...current,
                country: event.target.value,
              }))
            }
          >
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </SettingField>
        <SettingField label="Gender">
          <select
            value={accountForm.gender}
            onChange={(event) =>
              setAccountForm((current) => ({
                ...current,
                gender: event.target.value,
              }))
            }
          >
            <option value="">Not set</option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </SettingField>
        <SettingField label="Profile path">
          <select
            value={accountForm.profileType}
            onChange={(event) =>
              setAccountForm((current) => ({
                ...current,
                profileType: event.target.value,
              }))
            }
          >
            <option value="">Not set</option>
            {PROFILE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SettingField>
        {accountForm.profileType === "student" && (
          <SettingField label="College name">
            <input
              value={accountForm.collegeName}
              onChange={(event) =>
                setAccountForm((current) => ({
                  ...current,
                  collegeName: event.target.value,
                }))
              }
            />
          </SettingField>
        )}
        {accountForm.profileType === "employee" && (
          <SettingField label="Organization">
            <input
              value={accountForm.organizationName}
              onChange={(event) =>
                setAccountForm((current) => ({
                  ...current,
                  organizationName: event.target.value,
                }))
              }
            />
          </SettingField>
        )}
      </div>
      <div className="settings-action-row">
        <button className="settings-primary-button" type="submit" disabled={saving}>
          <Save size={16} />
          Save account
        </button>
      </div>
    </form>
  );

  const renderSecurity = () => (
    <div className="settings-stack">
      <form className="settings-form" onSubmit={savePassword}>
        <div className="settings-subheading">
          <KeyRound size={18} />
          <h3>Change password</h3>
        </div>
        <div className="settings-grid three">
          <SettingField label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
            />
          </SettingField>
          <SettingField label="New password">
            <input
              type="password"
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
            />
          </SettingField>
          <SettingField label="Confirm password">
            <input
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
            />
          </SettingField>
        </div>
        <div className="settings-action-row">
          <button className="settings-primary-button" type="submit" disabled={saving}>
            <Lock size={16} />
            Change password
          </button>
        </div>
      </form>

      <div className="settings-row-list">
        <SettingToggle
          label="Two-factor authentication"
          detail="Authenticator app support"
          checked={settings.security.twoFactorEnabled}
          onChange={(value) =>
            updatePreference("security", "twoFactorEnabled", value)
          }
        />
        <SettingToggle
          label="Suspicious login alerts"
          checked={settings.security.suspiciousLoginAlerts}
          onChange={(value) =>
            updatePreference("security", "suspiciousLoginAlerts", value)
          }
        />
        <SettingToggle
          label="Login history"
          checked={settings.security.loginHistoryEnabled}
          onChange={(value) =>
            updatePreference("security", "loginHistoryEnabled", value)
          }
        />
      </div>

      <div className="settings-subheading">
        <History size={18} />
        <h3>Active sessions</h3>
      </div>
      <div className="settings-session-list">
        {sessions.map((session) => (
          <article key={session.id}>
            <span className="settings-session-icon">
              {session.deviceType === "Mobile device" ? (
                <Smartphone size={18} />
              ) : (
                <Monitor size={18} />
              )}
            </span>
            <div>
              <strong>{session.deviceName}</strong>
              <small>
                {session.approximateLocation} - Last active:{" "}
                {formatRelativeTime(session.lastActiveAt)}
              </small>
              <small>
                {session.browser} - {session.operatingSystem} - IP{" "}
                {session.ipAddress}
              </small>
            </div>
            <button
              type="button"
              title="Logout session"
              onClick={() => logoutSession(session.id)}
            >
              <LogOut size={16} />
              Logout
            </button>
          </article>
        ))}
      </div>
      <div className="settings-action-row">
        <button className="settings-secondary-button" type="button" onClick={logoutAllSessions}>
          <LogOut size={16} />
          Logout from all devices
        </button>
        <button
          className="settings-secondary-button"
          type="button"
          onClick={() => setSessions(ensureCurrentSession(profile || currentUser))}
        >
          <RefreshCw size={16} />
          Refresh sessions
        </button>
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className="settings-stack">
      <div className="settings-grid two">
        <SettingSelect
          label="Profile visibility"
          value={settings.privacy.profileVisibility}
          options={["Public", "Friends only", "Private"]}
          onChange={(value) => updatePreference("privacy", "profileVisibility", value)}
        />
        <SettingSelect
          label="Submissions visibility"
          value={settings.visibility.submissions}
          options={["Public", "Friends only", "Private"]}
          onChange={(value) => updatePreference("visibility", "submissions", value)}
        />
      </div>
      <div className="settings-row-list">
        <SettingToggle
          label="Hide solved problems"
          checked={settings.privacy.hideSolvedProblems}
          onChange={(value) =>
            updatePreference("privacy", "hideSolvedProblems", value)
          }
        />
        <SettingToggle
          label="Hide my rank"
          checked={settings.privacy.hideRank}
          onChange={(value) => updatePreference("privacy", "hideRank", value)}
        />
        <SettingToggle
          label="Hide submissions"
          checked={settings.privacy.hideSubmissions}
          onChange={(value) =>
            updatePreference("privacy", "hideSubmissions", value)
          }
        />
      </div>
      <div className="settings-action-row">
        <button className="settings-secondary-button" type="button" onClick={downloadMyData}>
          <Download size={16} />
          Download my data
        </button>
        <button className="settings-secondary-button disabled" type="button" disabled>
          <Trash2 size={16} />
          Delete contest history
        </button>
      </div>
      <section className="settings-danger-zone">
        <div>
          <AlertTriangle size={18} />
          <h3>Danger Zone</h3>
        </div>
        <button type="button" onClick={() => openDangerAction("submissions")}>
          <Trash2 size={16} />
          Delete all submissions
        </button>
        <button type="button" onClick={() => openDangerAction("progress")}>
          <Trash2 size={16} />
          Delete progress data
        </button>
        <button type="button" onClick={() => openDangerAction("account")}>
          <Trash2 size={16} />
          Delete account permanently
        </button>
      </section>
    </div>
  );

  const renderCoding = () => (
    <div className="settings-stack">
      <div className="settings-grid three">
        <SettingSelect
          label="Default language"
          value={settings.coding.defaultLanguage}
          options={["python", "java"]}
          disabled
          onChange={(value) => updatePreference("coding", "defaultLanguage", value)}
        />
        <SettingSelect
          label="Editor theme"
          value={settings.coding.editorTheme}
          options={["Dark", "Light", "High contrast"]}
          disabled
          onChange={(value) => updatePreference("coding", "editorTheme", value)}
        />
        <SettingField label="Font size">
          <input
            type="number"
            min="12"
            max="24"
            value={settings.coding.fontSize}
            disabled
            onChange={(event) =>
              updatePreference("coding", "fontSize", Number(event.target.value))
            }
          />
        </SettingField>
        <SettingField label="Tab size">
          <input
            type="number"
            min="2"
            max="8"
            value={settings.coding.tabSize}
            disabled
            onChange={(event) =>
              updatePreference("coding", "tabSize", Number(event.target.value))
            }
          />
        </SettingField>
        <SettingSelect
          label="Keyboard shortcuts"
          value={settings.coding.keyboardShortcuts}
          options={["Default", "VS Code", "Vim"]}
          disabled
          onChange={(value) =>
            updatePreference("coding", "keyboardShortcuts", value)
          }
        />
      </div>
      <div className="settings-row-list">
        {[
          ["Auto-save code", "autoSaveCode"],
          ["Auto-run sample test cases", "autoRunSamples"],
          ["Autocomplete", "autocomplete"],
          ["AI hints", "aiHints"],
          ["Show boilerplate code", "showBoilerplate"],
        ].map(([label, key]) => (
          <SettingToggle
            key={key}
            label={label}
            checked={settings.coding[key]}
            disabled
            onChange={(value) => updatePreference("coding", key, value)}
          />
        ))}
      </div>
    </div>
  );

  const renderProblems = () => (
    <div className="settings-stack">
      <div className="settings-grid two">
        <SettingSelect
          label="Difficulty preference"
          value={settings.problems.difficultyPreference}
          options={["All", "Easy", "Medium", "Hard", "Extreme"]}
          onChange={(value) =>
            updatePreference("problems", "difficultyPreference", value)
          }
        />
      </div>
      <div className="settings-row-list">
        {[
          ["Show hints", "showHints"],
          ["Show tags", "showTags"],
          ["Show company tags", "showCompanyTags"],
          ["Show acceptance rate", "showAcceptanceRate"],
          ["Show solution after solving only", "solutionAfterSolvingOnly"],
          ["Daily challenge reminder", "dailyChallengeReminder"],
        ].map(([label, key]) => (
          <SettingToggle
            key={key}
            label={label}
            checked={settings.problems[key]}
            onChange={(value) => updatePreference("problems", key, value)}
          />
        ))}
      </div>
      <div className="settings-chip-grid">
        {PROBLEM_CATEGORIES.map((category) => (
          <button
            className={
              settings.problems.preferredCategories.includes(category)
                ? "active"
                : ""
            }
            type="button"
            key={category}
            onClick={() => updateCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="settings-stack">
      <div className="settings-grid two">
        <SettingSelect
          label="Contest reminder"
          value={settings.notifications.contestReminderOffset}
          options={["10 minutes", "30 minutes", "1 hour", "1 day"]}
          onChange={(value) =>
            updatePreference("notifications", "contestReminderOffset", value)
          }
        />
        <SettingField label="Daily challenge time">
          <input
            type="time"
            value={settings.notifications.dailyChallengeTime}
            onChange={(event) =>
              updatePreference(
                "notifications",
                "dailyChallengeTime",
                event.target.value
              )
            }
          />
        </SettingField>
      </div>
      <div className="settings-row-list">
        {[
          ["Email notifications", "emailNotifications"],
          ["Contest reminders", "contestReminders"],
          ["Daily challenge reminders", "dailyChallengeReminders"],
          ["Friend request notifications", "friendRequests"],
          ["Rank change notifications", "rankChanges"],
          ["Streak reminders", "streakReminders"],
          ["Submission result notifications", "submissionResults"],
          ["Blog comment notifications", "blogComments"],
          ["Newsletter", "newsletter"],
        ].map(([label, key]) => (
          <SettingToggle
            key={key}
            label={label}
            checked={settings.notifications[key]}
            onChange={(value) => updatePreference("notifications", key, value)}
          />
        ))}
      </div>
    </div>
  );

  const renderContests = () => (
    <div className="settings-stack">
      <div className="settings-grid two">
        <SettingSelect
          label="Contest reminder time"
          value={settings.contests.reminderTime}
          options={["10 minutes", "30 minutes", "1 hour", "1 day"]}
          onChange={(value) => updatePreference("contests", "reminderTime", value)}
        />
        <SettingSelect
          label="Default contest language"
          value={settings.contests.defaultLanguage}
          options={["python", "java"]}
          onChange={(value) =>
            updatePreference("contests", "defaultLanguage", value)
          }
        />
      </div>
      <div className="settings-row-list">
        {[
          ["Show live leaderboard", "showLiveLeaderboard"],
          ["Hide leaderboard during contest", "hideLeaderboardDuringContest"],
          ["Enable virtual contest mode", "virtualContestMode"],
          ["Auto-submit before timer ends", "autoSubmitBeforeTimerEnds"],
          ["Practice after contest", "practiceAfterContest"],
        ].map(([label, key]) => (
          <SettingToggle
            key={key}
            label={label}
            checked={settings.contests[key]}
            onChange={(value) => updatePreference("contests", key, value)}
          />
        ))}
      </div>
    </div>
  );

  const renderVisibility = () => (
    <div className="settings-grid three">
      {Object.entries({
        globalRank: "Global rank",
        collegeRank: "College rank",
        countryRank: "Country rank",
        solvedCount: "Solved count",
        contestRating: "Contest rating",
        badges: "Badges",
        streak: "Streak",
        blogs: "Blogs",
        submissions: "Submissions",
      }).map(([key, label]) => (
        <SettingSelect
          key={key}
          label={label}
          value={settings.visibility[key]}
          options={["Public", "Friends only", "Private"]}
          onChange={(value) => updatePreference("visibility", key, value)}
        />
      ))}
    </div>
  );

  const renderBlogs = () => (
    <div className="settings-stack">
      <div className="settings-grid two">
        <SettingSelect
          label="Default blog visibility"
          value={settings.blogs.defaultVisibility}
          options={["Public", "Friends only", "Private"]}
          onChange={(value) =>
            updatePreference("blogs", "defaultVisibility", value)
          }
        />
      </div>
      <div className="settings-row-list">
        {[
          ["Allow comments", "allowComments"],
          ["Allow likes", "allowLikes"],
          ["Show blogs on profile", "showOnProfile"],
          ["Enable markdown editor", "markdownEditor"],
          ["Auto-save drafts", "autoSaveDrafts"],
          ["AI grammar suggestions", "aiGrammarSuggestions"],
          ["AI blog summary", "aiBlogSummary"],
        ].map(([label, key]) => (
          <SettingToggle
            key={key}
            label={label}
            checked={settings.blogs[key]}
            onChange={(value) => updatePreference("blogs", key, value)}
          />
        ))}
      </div>
    </div>
  );

  const renderIntegrations = () => (
    <div className="settings-integration-grid">
      {Object.entries({
        github: "GitHub",
        googleCalendar: "Google Calendar",
        leetcode: "LeetCode",
        codeforces: "Codeforces",
        hackerRank: "HackerRank",
        linkedIn: "LinkedIn",
        discord: "Discord",
        googleAccount: "Google account",
      }).map(([key, label]) => (
        <button type="button" key={key} disabled>
          <Globe size={17} />
          <span>{label}</span>
          <small>Not connected</small>
        </button>
      ))}
    </div>
  );

  const renderBilling = () => (
    <div className="settings-billing-panel">
      <article>
        <span>Current plan</span>
        <strong>{settings.billing.currentPlan}</strong>
      </article>
      <article>
        <span>AI credits usage</span>
        <strong>{settings.billing.aiCreditsUsage}</strong>
      </article>
      <button type="button" disabled>
        Upgrade plan
      </button>
      <button type="button" disabled>
        Billing history
      </button>
      <button type="button" disabled>
        Payment method
      </button>
      <button type="button" disabled>
        Cancel subscription
      </button>
    </div>
  );

  const renderAccessibility = () => (
    <div className="settings-stack">
      <div className="settings-grid two">
        <SettingSelect
          label="Dark mode / light mode"
          value={settings.accessibility.colorMode}
          options={["Dark", "Light", "System"]}
          onChange={(value) =>
            updatePreference("accessibility", "colorMode", value)
          }
        />
        <SettingSelect
          label="Font size"
          value={settings.accessibility.fontSize}
          options={["Small", "Default", "Large"]}
          onChange={(value) => updatePreference("accessibility", "fontSize", value)}
        />
      </div>
      <div className="settings-row-list">
        <SettingToggle
          label="High contrast mode"
          checked={settings.accessibility.highContrast}
          onChange={(value) =>
            updatePreference("accessibility", "highContrast", value)
          }
        />
        <SettingToggle
          label="Dyslexia-friendly font"
          checked={settings.accessibility.dyslexiaFriendlyFont}
          onChange={(value) =>
            updatePreference("accessibility", "dyslexiaFriendlyFont", value)
          }
        />
        <SettingToggle
          label="Keyboard navigation"
          checked={settings.accessibility.keyboardNavigation}
          onChange={(value) =>
            updatePreference("accessibility", "keyboardNavigation", value)
          }
        />
      </div>
    </div>
  );

  const renderAppearance = () => (
    <div className="settings-stack">
      <div className="settings-grid three">
        <SettingSelect
          label="Theme"
          value={settings.appearance.theme}
          options={["Dark", "Light", "System"]}
          onChange={(value) => updatePreference("appearance", "theme", value)}
        />
        <SettingSelect
          label="Accent color"
          value={settings.appearance.accentColor}
          options={["Silver", "Teal", "Gold", "Coral", "Blue"]}
          onChange={(value) => updatePreference("appearance", "accentColor", value)}
        />
        <SettingSelect
          label="Dashboard layout"
          value={settings.appearance.dashboardLayout}
          options={["Standard", "Focus Mode", "Compact"]}
          onChange={(value) =>
            updatePreference("appearance", "dashboardLayout", value)
          }
        />
        <SettingSelect
          label="Editor layout"
          value={settings.appearance.editorLayout}
          options={["Split", "Editor first", "Problem first"]}
          onChange={(value) => updatePreference("appearance", "editorLayout", value)}
        />
      </div>
      <div className="settings-row-list">
        <SettingToggle
          label="Compact mode"
          checked={settings.appearance.compactMode}
          onChange={(value) => updatePreference("appearance", "compactMode", value)}
        />
        <SettingToggle
          label="Sidebar collapsed"
          checked={settings.appearance.sidebarCollapsed}
          onChange={(value) =>
            updatePreference("appearance", "sidebarCollapsed", value)
          }
        />
      </div>
    </div>
  );

  const renderAi = () => (
    <div className="settings-stack">
      <div className="settings-grid two">
        <SettingSelect
          label="AI difficulty level"
          value={settings.ai.difficultyLevel}
          options={["Beginner", "Balanced", "Advanced"]}
          disabled
          onChange={(value) => updatePreference("ai", "difficultyLevel", value)}
        />
      </div>
      <div className="settings-row-list">
        {[
          ["Enable AI hints", "hints"],
          ["Enable AI code review", "codeReview"],
          ["Enable AI explanation", "explanation"],
          ["Enable AI debugging", "debugging"],
          ["Save AI chat history", "saveChatHistory"],
          ["AI can access my submissions", "canAccessSubmissions"],
          ["AI can access my progress", "canAccessProgress"],
          ["AI can generate hints before solution", "canGenerateHintsBeforeSolution"],
        ].map(([label, key]) => (
          <SettingToggle
            key={key}
            label={label}
            checked={settings.ai[key]}
            disabled
            onChange={(value) => updatePreference("ai", key, value)}
          />
        ))}
      </div>
      <div className="settings-action-row">
        <button className="settings-secondary-button" type="button" disabled>
          <Trash2 size={16} />
          Delete AI chat history
        </button>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    if (activeSection === "account") return renderAccount();
    if (activeSection === "security") return renderSecurity();
    if (activeSection === "privacy") return renderPrivacy();
    if (activeSection === "coding") return renderCoding();
    if (activeSection === "problems") return renderProblems();
    if (activeSection === "notifications") return renderNotifications();
    if (activeSection === "contests") return renderContests();
    if (activeSection === "visibility") return renderVisibility();
    if (activeSection === "blogs") return renderBlogs();
    if (activeSection === "integrations") return renderIntegrations();
    if (activeSection === "billing") return renderBilling();
    if (activeSection === "accessibility") return renderAccessibility();
    if (activeSection === "appearance") return renderAppearance();
    return renderAi();
  };

  const dangerCopy = {
    submissions: {
      title: "Delete all submissions",
      body: "This removes your stored source code, verdicts, runtime, and test results.",
    },
    progress: {
      title: "Delete progress data",
      body: "This removes solved status, activity streaks, drafts, and problem notes.",
    },
    account: {
      title: "Delete account permanently",
      body: "This removes your profile and linked CodeArena data. This cannot be undone.",
    },
  };

  if (!settingsReady) {
    return <p className="profile-loading">Loading settings...</p>;
  }

  return (
    <div className="page settings-page">
      <header className="settings-page-header">
        <div>
          <span className="profile-eyebrow">Player control panel</span>
          <h1>Settings</h1>
        </div>
        <div className="settings-sync-status">
          <SettingsIcon size={17} />
          <span>
            {saving
              ? "Saving"
              : settingsSetupMissing
              ? "Local fallback"
              : "Synced"}
          </span>
        </div>
      </header>

      {settingsSetupMissing && (
        <p className="settings-schema-note">
          Run backend/schemas/settings-schema.sql in Supabase to sync settings
          across devices.
        </p>
      )}

      <div className="settings-layout">
        <aside className="settings-nav" aria-label="Settings sections">
          {SECTION_CONFIG.map(({ id, label, icon: Icon, badge }) => (
            <button
              className={activeSection === id ? "active" : ""}
              type="button"
              key={id}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {badge && <small>{badge}</small>}
            </button>
          ))}
        </aside>

        <main className="settings-panel">
          <div className="settings-panel-heading">
            <span>
              <ActiveIcon size={20} />
            </span>
            <div>
              <span className="profile-eyebrow">{activeConfig.label}</span>
              <h2>{activeConfig.label} Settings</h2>
            </div>
            {disabledSection && <b>{disabledSection}</b>}
          </div>

          {renderActiveSection()}
        </main>
      </div>

      {dangerAction && (
        <div className="settings-modal-backdrop" role="presentation">
          <section
            className="settings-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-confirm-title"
          >
            <div className="settings-confirm-heading">
              <div>
                <span className="profile-eyebrow">Confirmation required</span>
                <h2 id="settings-confirm-title">{dangerCopy[dangerAction].title}</h2>
              </div>
              <button
                type="button"
                aria-label="Close confirmation"
                onClick={closeDangerAction}
                disabled={dangerRunning}
              >
                <X size={18} />
              </button>
            </div>

            <p>{dangerCopy[dangerAction].body}</p>
            <SettingField label="Type DELETE to confirm">
              <input
                value={dangerInput}
                onChange={(event) => setDangerInput(event.target.value)}
                disabled={dangerRunning}
              />
            </SettingField>

            <div className="settings-action-row">
              <button
                className="settings-secondary-button"
                type="button"
                onClick={closeDangerAction}
                disabled={dangerRunning}
              >
                Cancel
              </button>
              <button
                className="settings-danger-button"
                type="button"
                onClick={executeDangerAction}
                disabled={dangerInput !== "DELETE" || dangerRunning}
              >
                <Trash2 size={16} />
                {dangerRunning ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

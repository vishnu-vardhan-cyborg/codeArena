import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Compass,
  Gamepad2,
  Home as HomeIcon,
  Hourglass,
  LogOut,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import {
  loadUnreadNotificationSnapshot,
  NOTIFICATION_COUNT_EVENT,
} from "../utils/notificationCenter";

const mainNavigation = [
  {
    label: "Home",
    path: "/home",
    icon: HomeIcon,
    match: ({ pathname }) =>
      pathname === "/home" ||
      pathname === "/practice-arena" ||
      pathname.startsWith("/problems/"),
  },
  { label: "Clans", path: "/clans", icon: Shield },
  {
    label: "Aura Farming",
    path: "/aura-farming",
    icon: Sparkles,
    match: ({ pathname }) => pathname === "/aura-farming" || pathname === "/posts",
  },
  { label: "Time Capsules", path: "/time-capsules", icon: Hourglass },
  { label: "Chat", path: "/chat", icon: MessageCircle },
  {
    label: "Rabbit Hole",
    path: "/rabbit-hole",
    icon: BookOpen,
    match: ({ pathname }) => pathname.startsWith("/rabbit-hole"),
  },
  { label: "Power Up Hunt", path: "/power-up-hunt", icon: Gamepad2 },
];

const readLoggedInUser = () => {
  try {
    return JSON.parse(localStorage.getItem("loggedInUser") || "{}");
  } catch {
    return {};
  }
};

export default function AppSidebar({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(readLoggedInUser);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    setCurrentUser(readLoggedInUser());
  }, [location.pathname, location.hash]);

  const currentUserId = currentUser?.id ? String(currentUser.id) : "";

  const refreshNotificationCount = useCallback(async () => {
    if (!currentUserId) {
      setNotificationCount(0);
      return;
    }

    const snapshot = await loadUnreadNotificationSnapshot(currentUserId);
    setNotificationCount(snapshot.count);
  }, [currentUserId]);

  useEffect(() => {
    refreshNotificationCount();

    const handleCount = (event) => {
      if (typeof event.detail?.count === "number") {
        setNotificationCount(event.detail.count);
      } else {
        refreshNotificationCount();
      }
    };

    window.addEventListener(NOTIFICATION_COUNT_EVENT, handleCount);
    window.addEventListener("xp-notifications-updated", handleCount);

    return () => {
      window.removeEventListener(NOTIFICATION_COUNT_EVENT, handleCount);
      window.removeEventListener("xp-notifications-updated", handleCount);
    };
  }, [refreshNotificationCount]);

  const goTo = (path) => {
    navigate(path);
    onClose?.();
  };

  const logout = () => {
    const savedTheme = localStorage.getItem("codeArenaTheme");
    localStorage.clear();
    if (savedTheme) {
      localStorage.setItem("codeArenaTheme", savedTheme);
    }
    navigate("/login");
    onClose?.();
  };

  const isActive = (item) =>
    item.match
      ? item.match(location)
      : location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`);

  const profileActive = location.pathname === "/profile";
  const exploreActive = location.pathname === "/explore";
  const notificationsActive = location.pathname === "/notifications";
  const settingsActive = location.pathname === "/settings";
  const playerName =
    currentUser.uusername || currentUser.username || "Arena Player";
  const playerXp = Number(currentUser.xp || 0);

  return (
    <aside className="home-sidebar">
      <div className="home-sidebar-brand">
        <span>CA</span>
        <strong>CodeArena</strong>
        <button type="button" aria-label="Close navigation" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <button
        className={`home-player-summary ${
          profileActive && !exploreActive ? "active-home-nav" : ""
        }`}
        type="button"
        aria-label="Open profile"
        aria-current={profileActive && !exploreActive ? "page" : undefined}
        onClick={() => goTo("/profile")}
      >
        {currentUser.profile_pic ? (
          <img src={currentUser.profile_pic} alt="" />
        ) : (
          <span>{playerName[0]}</span>
        )}
        <div>
          <strong>{playerName}</strong>
          <small>{playerXp} XP</small>
        </div>
      </button>

      <nav className="home-primary-nav" aria-label="Main navigation">
        <span className="home-nav-label">Arena</span>
        {mainNavigation.map(({ label, path, icon: Icon, ...item }) => {
          const active = isActive({ path, ...item });
          return (
            <button
              className={active ? "active-home-nav" : ""}
              type="button"
              key={path}
              aria-current={active ? "page" : undefined}
              onClick={() => goTo(path)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          className={exploreActive ? "active-home-nav" : ""}
          type="button"
          aria-current={exploreActive ? "page" : undefined}
          onClick={() => goTo("/explore")}
        >
          <Compass size={18} />
          <span>Explore</span>
        </button>
      </nav>

      <nav className="home-account-nav" aria-label="Account navigation">
        <span className="home-nav-label">Account</span>
        <button
          className={`notifications-nav ${
            notificationsActive ? "active-home-nav" : ""
          }`}
          type="button"
          aria-current={notificationsActive ? "page" : undefined}
          onClick={() => goTo("/notifications")}
        >
          <Bell size={18} />
          <span>Notifications</span>
          {notificationCount > 0 && (
            <b className="home-notification-badge">
              {notificationCount > 99 ? "99+" : notificationCount}
            </b>
          )}
        </button>
        <button
          className={`account-settings-nav ${
            settingsActive ? "active-home-nav" : ""
          }`}
          type="button"
          aria-current={settingsActive ? "page" : undefined}
          onClick={() => goTo("/settings")}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button className="logout-nav" type="button" onClick={logout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}

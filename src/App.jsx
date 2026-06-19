import { useCallback, useEffect, useRef, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Preview from "./pages/Preview";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Posts from "./pages/Posts";
import Clan from "./pages/Clan";
import TimeCapsules from "./pages/TimeCapsules";
import TimeCapsuleDetail from "./pages/TimeCapsuleDetail";
import Chat from "./pages/Chat";
import Problem from "./pages/Problem";
import PracticeArena from "./pages/PracticeArena";
import RabbitHole from "./pages/RabbitHole";
import LearningPath from "./pages/LearningPath";
import PowerUpHunt from "./pages/PowerUpHunt";
import SeasonDetails from "./pages/SeasonDetails";
import Notifications from "./components/Notifications";
import ThemeToggle from "./components/ThemeToggle";
import AuthenticatedShell from "./components/AuthenticatedShell";
import "./App.css";
import "./styles/Theme.css";
import "./styles/VisualRefresh.css";

import {
  joinUserNotificationRoom,
  socket,
} from "./socket";
import {
  broadcastNotificationCount,
  getNotificationText,
  loadNotificationActors,
  loadUnreadNotificationSnapshot,
  loadXpNotifications,
  NOTIFICATION_TOAST_EVENT,
  pushNotificationToast,
  XP_NOTIFICATIONS_KEY,
} from "./utils/notificationCenter";

function saveXpNotification(notification) {
  const existingNotifications = loadXpNotifications();

  const nextNotifications = [
    notification,
    ...existingNotifications.filter(
      (item) => item.id !== notification.id
    ),
  ].slice(0, 30);

  localStorage.setItem(
    XP_NOTIFICATIONS_KEY,
    JSON.stringify(nextNotifications)
  );

  window.dispatchEvent(
    new CustomEvent("xp-notifications-updated", {
      detail: nextNotifications,
    })
  );

  pushNotificationToast({
    id: notification.id,
    title: "XP update",
    body: `${notification.senderName} gained +${notification.amount} XP.`,
  });
}

function LiveNotificationListener() {
  const location = useLocation();
  const knownSocialIdsRef = useRef(new Set());
  const knownFriendRequestIdsRef = useRef(new Set());
  const socialPollInitializedRef = useRef(false);
  const activeUserRef = useRef("");

  useEffect(() => {
    const currentUser = JSON.parse(
      localStorage.getItem("loggedInUser") || "null"
    );

    if (!currentUser?.id) {
      return;
    }

    joinUserNotificationRoom(currentUser.id);
  }, [location.pathname]);

  useEffect(() => {
    const currentUser = JSON.parse(
      localStorage.getItem("loggedInUser") || "null"
    );
    const currentUserId = currentUser?.id ? String(currentUser.id) : "";

    if (!currentUserId) {
      broadcastNotificationCount(0);
      knownSocialIdsRef.current = new Set();
      knownFriendRequestIdsRef.current = new Set();
      socialPollInitializedRef.current = false;
      activeUserRef.current = "";
      return undefined;
    }

    if (activeUserRef.current !== currentUserId) {
      knownSocialIdsRef.current = new Set();
      knownFriendRequestIdsRef.current = new Set();
      socialPollInitializedRef.current = false;
      activeUserRef.current = currentUserId;
    }

    let cancelled = false;

    const pollNotifications = async () => {
      try {
        const snapshot = await loadUnreadNotificationSnapshot(currentUserId);
        if (cancelled) return;

        broadcastNotificationCount(snapshot.count);

        const knownIds = knownSocialIdsRef.current;
        const knownFriendRequestIds = knownFriendRequestIdsRef.current;
        const newNotifications = snapshot.socialNotifications.filter(
          (notification) => !knownIds.has(notification.id)
        );
        const newFriendRequests = snapshot.pendingRequests.filter(
          (request) => !knownFriendRequestIds.has(request.id)
        );

        knownSocialIdsRef.current = new Set(
          snapshot.socialNotifications.map((notification) => notification.id)
        );
        knownFriendRequestIdsRef.current = new Set(
          snapshot.pendingRequests.map((request) => request.id)
        );

        if (!socialPollInitializedRef.current) {
          socialPollInitializedRef.current = true;
          return;
        }

        if (newNotifications.length === 0 && newFriendRequests.length === 0) {
          return;
        }

        const normalizedFriendRequests = newFriendRequests.map((request) => ({
          id: request.id,
          actor_id: request.sender_id,
          notification_type: "friend_request",
          created_at: request.created_at,
          metadata: {},
        }));
        const toastCandidates = [
          ...newNotifications,
          ...normalizedFriendRequests,
        ].sort(
          (first, second) =>
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime()
        );
        const actorMap = await loadNotificationActors(toastCandidates);
        if (cancelled) return;

        const newest = toastCandidates[0];
        pushNotificationToast({
          id: newest.id,
          title: "New notification",
          body: getNotificationText(
            newest,
            actorMap.get(String(newest.actor_id))
          ),
        });
      } catch {
        // Notification polling should never block the rest of the app.
      }
    };

    pollNotifications();
    const pollTimer = window.setInterval(pollNotifications, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
    };
  }, [location.pathname]);

  useEffect(() => {
    const saveAttackNotification = (notification) => {
      pushNotificationToast({
        id: notification.id || `${notification.recipientId}-${Date.now()}`,
        title: "Capsule attack",
        body: notification.message || "You received an attack notification.",
      });

      const currentUser = JSON.parse(
        localStorage.getItem("loggedInUser") || "null"
      );
      if (currentUser?.id) {
        loadUnreadNotificationSnapshot(String(currentUser.id)).then((snapshot) =>
          broadcastNotificationCount(snapshot.count)
        );
      }
    };

    socket.on("xp:notification", saveXpNotification);
    socket.on("attack:notification", saveAttackNotification);

    return () => {
      socket.off("xp:notification", saveXpNotification);
      socket.off("attack:notification", saveAttackNotification);
    };
  }, []);

  return null;
}

function NotificationToastHost() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleToast = (event) => {
      setToast(event.detail);
    };

    window.addEventListener(NOTIFICATION_TOAST_EVENT, handleToast);

    return () => {
      window.removeEventListener(NOTIFICATION_TOAST_EVENT, handleToast);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const handleToastClick = useCallback(() => {
    const targetRoute =
      toast?.dismissOnly || toast?.to === null
        ? ""
        : toast?.to || "/notifications";

    setToast(null);

    if (targetRoute) {
      navigate(targetRoute);
    }
  }, [navigate, toast]);

  if (!toast) return null;

  return (
    <button
      className={`notification-toast ${
        toast.tone ? `toast-${toast.tone}` : ""
      }`}
      type="button"
      onClick={handleToastClick}
    >
      <strong>{toast.title || "Notification"}</strong>
      <span>{toast.body}</span>
    </button>
  );
}

function RequireAuth({ children }) {
  const isLoggedIn =
    localStorage.getItem("isLoggedIn") === "true";

  return isLoggedIn
    ? children
    : <Navigate to="/login" />;
}

function ProtectedShellPage({ children }) {
  return (
    <RequireAuth>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </RequireAuth>
  );
}


export default function App() {
  return (
    <>
      <LiveNotificationListener />
      <NotificationToastHost />
      <ThemeToggle />

      <Routes>
        <Route
          path="/"
          element={<Preview />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route
          path="/home"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedShellPage>
              <Profile />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/profile/:playerId"
          element={
            <ProtectedShellPage>
              <PublicProfile />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/posts"
          element={
            <ProtectedShellPage>
              <Posts />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/career-loadout"
          element={<Navigate to="/profile" replace />}
        />

        <Route
          path="/notifications"
          element={
            <ProtectedShellPage>
              <Notifications />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/clans"
          element={
            <ProtectedShellPage>
              <Clan />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/time-capsules"
          element={
            <ProtectedShellPage>
              <TimeCapsules />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/time-capsules/:capsuleId"
          element={
            <ProtectedShellPage>
              <TimeCapsuleDetail />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedShellPage>
              <Chat />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/practice-arena"
          element={
            <ProtectedShellPage>
              <PracticeArena />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/problems/:problemId"
          element={
            <ProtectedShellPage>
              <Problem />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/rabbit-hole"
          element={
            <ProtectedShellPage>
              <RabbitHole />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/rabbit-hole/:pathId"
          element={
            <ProtectedShellPage>
              <LearningPath />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/power-up-hunt"
          element={
            <ProtectedShellPage>
              <PowerUpHunt />
            </ProtectedShellPage>
          }
        />

        <Route
          path="/season-one"
          element={
            <ProtectedShellPage>
              <SeasonDetails />
            </ProtectedShellPage>
          }
        />
      </Routes>
    </>
  );
}

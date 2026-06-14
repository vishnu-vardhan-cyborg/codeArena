import { useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Clan from "./pages/Clan";
import Chat from "./pages/Chat";
import Problem from "./pages/Problem";
import Notifications from "./components/Notifications";
import "./App.css";

import {
  joinUserNotificationRoom,
  socket,
} from "./socket";

const XP_NOTIFICATIONS_KEY = "xpNotifications";

function saveXpNotification(notification) {
  const existingNotifications = JSON.parse(
    localStorage.getItem(XP_NOTIFICATIONS_KEY) || "[]"
  );

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
}

function LiveNotificationListener() {
  const location = useLocation();

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
    socket.on("xp:notification", saveXpNotification);

    return () => {
      socket.off("xp:notification", saveXpNotification);
    };
  }, []);

  return null;
}

function RequireAuth({ children }) {
  const isLoggedIn =
    localStorage.getItem("isLoggedIn") === "true";

  return isLoggedIn
    ? children
    : <Navigate to="/" />;
}


export default function App() {
  return (
    <>
      <LiveNotificationListener />

      <Routes>
        <Route
          path="/"
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
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <Notifications />
            </RequireAuth>
          }
        />

        <Route
          path="/clans"
          element={
            <RequireAuth>
              <Clan />
            </RequireAuth>
          }
        />

        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />

        <Route
          path="/problems/:problemId"
          element={
            <RequireAuth>
              <Problem />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

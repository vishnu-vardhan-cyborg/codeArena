import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Check, UserPlus, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/Notifications.css";

const XP_NOTIFICATIONS_KEY = "xpNotifications";
const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";
const SOCIAL_TABLE_MISSING_CODES = new Set(["PGRST205", "42P01"]);

const loadXpNotifications = () => {
  try {
    return JSON.parse(localStorage.getItem(XP_NOTIFICATIONS_KEY) || "[]");
  } catch {
    return [];
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInUser") || "null");
    } catch {
      return null;
    }
  });
  const currentUserId = currentUser?.id ? String(currentUser.id) : "";

  const [requests, setRequests] = useState([]);
  const [socialNotifications, setSocialNotifications] = useState([]);
  const [xpNotifications, setXpNotifications] = useState(loadXpNotifications);
  const [loading, setLoading] = useState(true);
  const [socialSetupMissing, setSocialSetupMissing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);

    const [
      { data: requestData },
      { data: socialData, error: socialError },
    ] = await Promise.all([
      supabase
        .from("friend_requests")
        .select("*")
        .eq("receiver_id", currentUser.id)
        .eq("status", "pending"),
      supabase
        .from("social_notifications")
        .select(
          "id, actor_id, notification_type, post_id, metadata, is_read, created_at"
        )
        .eq("recipient_id", currentUserId)
        .neq("notification_type", "friend_request")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (
      socialError &&
      SOCIAL_TABLE_MISSING_CODES.has(socialError.code)
    ) {
      setSocialSetupMissing(true);
    } else if (!socialError) {
      setSocialSetupMissing(false);
    }

    const actorIds = [
      ...new Set(
        [
          ...(requestData || []).map((request) => String(request.sender_id)),
          ...(socialData || []).map((item) => String(item.actor_id)),
        ].filter(Boolean)
      ),
    ];

    let profiles = [];
    if (actorIds.length > 0) {
      const { data } = await supabase
        .from("lusers")
        .select("*")
        .in("id", actorIds);
      profiles = data || [];
    }

    const profileById = new Map(
      profiles.map((profile) => [String(profile.id), profile])
    );

    setRequests(
      (requestData || []).map((request) => ({
        ...request,
        sender: profileById.get(String(request.sender_id)),
      }))
    );
    setSocialNotifications(
      (socialData || []).map((notification) => ({
        ...notification,
        actor: profileById.get(String(notification.actor_id)),
      }))
    );
    setLoading(false);
  }, [currentUser?.id, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login", { replace: true });
      return undefined;
    }

    fetchNotifications();

    const handleXpNotificationsUpdated = (event) => {
      setXpNotifications(event.detail || loadXpNotifications());
    };

    window.addEventListener(
      "xp-notifications-updated",
      handleXpNotificationsUpdated
    );

    return () => {
      window.removeEventListener(
        "xp-notifications-updated",
        handleXpNotificationsUpdated
      );
    };
  }, [currentUserId, fetchNotifications, navigate]);

  const clearXpNotifications = () => {
    localStorage.removeItem(XP_NOTIFICATIONS_KEY);
    setXpNotifications([]);
  };

  const acceptRequest = async (request) => {
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", request.id);

    await supabase.from("friends").insert([
      {
        user1_id: request.sender_id,
        user2_id: request.receiver_id,
      },
    ]);

    fetchNotifications();
  };

  const rejectRequest = async (requestId) => {
    await supabase
      .from("friend_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);

    fetchNotifications();
  };

  const markAllRead = async () => {
    const unreadIds = socialNotifications
      .filter((item) => !item.is_read)
      .map((item) => item.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("social_notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    if (!error) {
      setSocialNotifications((items) =>
        items.map((item) => ({ ...item, is_read: true }))
      );
    }
  };

  const unreadCount = useMemo(
    () => socialNotifications.filter((item) => !item.is_read).length,
    [socialNotifications]
  );
  const hasNotifications =
    requests.length > 0 ||
    socialNotifications.length > 0 ||
    xpNotifications.length > 0;

  return (
    <div className="page notifications-page">
      <header className="notifications-header">
        <div>
          <span>Activity center</span>
          <h1>Notifications</h1>
          <p>Friend requests, follows, and posts from your network.</p>
        </div>
        <button
          className="notifications-back-button"
          type="button"
          onClick={() => navigate("/home")}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </header>

      {socialSetupMissing && (
        <p className="notifications-setup-note">
          Run <strong>backend/social-schema.sql</strong> in Supabase to enable
          follow and post notifications.
        </p>
      )}

      <div className="notifications-summary">
        <div>
          <Bell size={18} />
          <span>
            <strong>{unreadCount}</strong>
            unread network updates
          </span>
        </div>
        <button type="button" onClick={markAllRead} disabled={!unreadCount}>
          <Check size={15} />
          Mark all read
        </button>
      </div>

      {loading ? (
        <p className="notifications-empty">Loading notifications...</p>
      ) : !hasNotifications ? (
        <p className="notifications-empty">No notifications yet.</p>
      ) : (
        <main className="notifications-layout">
          <div className="notifications-feed">
            {requests.length > 0 && (
              <section className="notification-group">
                <div className="notification-section-heading">
                  <div>
                    <UserPlus size={17} />
                    <h2>Friend requests</h2>
                  </div>
                  <span>{requests.length}</span>
                </div>

                {requests.map((request) => (
                  <article className="notification-card" key={request.id}>
                    <img
                      src={request.sender?.profile_pic || DEFAULT_AVATAR}
                      alt=""
                    />
                    <div>
                      <strong>
                        {request.sender?.uusername ||
                          request.sender?.username ||
                          "Arena player"}
                      </strong>
                      <p>wants to be your friend.</p>
                    </div>
                    <div className="notification-actions">
                      <button
                        type="button"
                        onClick={() => acceptRequest(request)}
                      >
                        Accept
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => rejectRequest(request.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {socialNotifications.length > 0 && (
              <section className="notification-group">
                <div className="notification-section-heading">
                  <div>
                    <UsersRound size={17} />
                    <h2>Network activity</h2>
                  </div>
                  <span>{socialNotifications.length}</span>
                </div>

                {socialNotifications.map((notification) => (
                  <article
                    className={`notification-card ${
                      notification.is_read ? "" : "unread"
                    }`}
                    key={notification.id}
                  >
                    <img
                      src={notification.actor?.profile_pic || DEFAULT_AVATAR}
                      alt=""
                    />
                    <div>
                      <strong>
                        {notification.actor?.uusername ||
                          notification.actor?.username ||
                          "Arena player"}
                      </strong>
                      <p>
                        {notification.notification_type === "follow"
                          ? "followed you."
                          : "shared a new post."}
                      </p>
                      {notification.notification_type === "post" &&
                        notification.metadata?.preview && (
                          <blockquote>
                            {notification.metadata.preview}
                          </blockquote>
                        )}
                      <small>
                        {new Date(notification.created_at).toLocaleString()}
                      </small>
                    </div>
                    {!notification.is_read && (
                      <span className="notification-unread-dot" title="Unread" />
                    )}
                  </article>
                ))}
              </section>
            )}
          </div>

          {xpNotifications.length > 0 && (
            <aside className="notification-group xp-notification-group">
              <div className="notification-section-heading">
                <div>
                  <Bell size={17} />
                  <h2>Friend XP</h2>
                </div>
                <button type="button" onClick={clearXpNotifications}>
                  Clear
                </button>
              </div>

              {xpNotifications.map((notification) => (
                <article
                  className="notification-card xp-notification-card"
                  key={notification.id}
                >
                  <div>
                    <strong>{notification.senderName}</strong>
                    <p>
                      gained +{notification.amount} XP and now has{" "}
                      {notification.xp} XP.
                    </p>
                    <small>
                      {new Date(notification.createdAt).toLocaleString()}
                    </small>
                  </div>
                </article>
              ))}
            </aside>
          )}
        </main>
      )}
    </div>
  );
}

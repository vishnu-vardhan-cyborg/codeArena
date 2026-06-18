import { supabase } from "../supabase";

export const XP_NOTIFICATIONS_KEY = "xpNotifications";
export const NOTIFICATION_COUNT_EVENT = "codearena-notification-count";
export const NOTIFICATION_TOAST_EVENT = "codearena-notification-toast";

export const loadXpNotifications = () => {
  try {
    return JSON.parse(localStorage.getItem(XP_NOTIFICATIONS_KEY) || "[]");
  } catch {
    return [];
  }
};

export const broadcastNotificationCount = (count) => {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_COUNT_EVENT, {
      detail: { count: Number(count) || 0 },
    })
  );
};

export const pushNotificationToast = (toast) => {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_TOAST_EVENT, {
      detail: toast,
    })
  );
};

export const getNotificationText = (notification, actor) => {
  const actorName =
    actor?.uusername || actor?.username || notification?.senderName || "Arena player";

  if (notification?.notification_type === "follow") {
    return `${actorName} followed you.`;
  }

  if (notification?.notification_type === "post") {
    return `${actorName} shared a new post.`;
  }

  if (notification?.notification_type === "time_capsule_invite") {
    const title = notification.metadata?.capsuleTitle || "a Time Capsule";
    return `${actorName} requested you to join ${title}.`;
  }

  if (notification?.notification_type === "friend_request") {
    return `${actorName} sent you a friend request.`;
  }

  return `${actorName} sent you a notification.`;
};

export const loadNotificationActors = async (notifications = []) => {
  const actorIds = [
    ...new Set(
      notifications
        .map((notification) => String(notification.actor_id || ""))
        .filter(Boolean)
    ),
  ];

  if (actorIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase
    .from("lusers")
    .select("id, username, uusername, profile_pic")
    .in("id", actorIds);

  return new Map((data || []).map((profile) => [String(profile.id), profile]));
};

export const loadUnreadNotificationSnapshot = async (userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      count: 0,
      socialNotifications: [],
      pendingRequests: [],
      pendingRequestCount: 0,
    };
  }

  let pendingRequests = [];
  let socialNotifications = [];

  const requestResult = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, created_at")
    .eq("receiver_id", normalizedUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!requestResult.error) {
    pendingRequests = requestResult.data || [];
  }

  const socialResult = await supabase
    .from("social_notifications")
    .select(
      "id, actor_id, notification_type, post_id, metadata, is_read, created_at"
    )
    .eq("recipient_id", normalizedUserId)
    .eq("is_read", false)
    .neq("notification_type", "friend_request")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!socialResult.error) {
    socialNotifications = socialResult.data || [];
  }

  return {
    count:
      pendingRequests.length +
      socialNotifications.length +
      loadXpNotifications().length,
    socialNotifications,
    pendingRequests,
    pendingRequestCount: pendingRequests.length,
  };
};

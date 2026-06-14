import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

const XP_NOTIFICATIONS_KEY = "xpNotifications";

const loadXpNotifications = () =>
  JSON.parse(localStorage.getItem(XP_NOTIFICATIONS_KEY) || "[]");

export default function Notifications() {
  const navigate = useNavigate();

  const currentUser = JSON.parse(
    localStorage.getItem("loggedInUser")
  );

  const [requests, setRequests] = useState([]);
  const [xpNotifications, setXpNotifications] =
    useState(loadXpNotifications);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("receiver_id", currentUser.id)
      .eq("status", "pending");

    const enriched = [];

    for (const req of data || []) {
      const { data: sender } =
        await supabase
          .from("lusers")
          .select("*")
          .eq("id", req.sender_id)
          .single();

      enriched.push({
        ...req,
        sender,
      });
    }

    setRequests(enriched);
  }, [currentUser.id]);

  useEffect(() => {
    fetchRequests();

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
  }, [fetchRequests]);

  const clearXpNotifications = () => {
    localStorage.removeItem(XP_NOTIFICATIONS_KEY);
    setXpNotifications([]);
  };

  const acceptRequest = async (
    request
  ) => {
    await supabase
      .from("friend_requests")
      .update({
        status: "accepted",
      })
      .eq("id", request.id);

    await supabase
      .from("friends")
      .insert([
        {
          user1_id:
            request.sender_id,

          user2_id:
            request.receiver_id,
        },
      ]);

    fetchRequests();
  };

  const rejectRequest = async (
    requestId
  ) => {
    await supabase
      .from("friend_requests")
      .update({
        status: "rejected",
      })
      .eq("id", requestId);

    fetchRequests();
  };

  const hasNotifications =
    requests.length > 0 || xpNotifications.length > 0;

  return (
    <div className="page">
      <h1>Notifications</h1>

      <button
        onClick={() =>
          navigate("/home")
        }
      >
        Back
      </button>

      {!hasNotifications && (
        <p>No notifications</p>
      )}

      {xpNotifications.length > 0 && (
        <div className="notification-group">
          <div className="notification-heading">
            <h2>Friend XP Updates</h2>
            <button
              className="btn secondary-btn"
              onClick={clearXpNotifications}
            >
              Clear
            </button>
          </div>

          {xpNotifications.map((notification) => (
            <div
              key={notification.id}
              className="notification-card live-notification"
            >
              <h3>{notification.senderName}</h3>

              <p>
                gained +{notification.amount} XP and now has{" "}
                {notification.xp} XP
              </p>

              <small>
                {new Date(notification.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
      )}

      {requests.length > 0 && (
        <div className="notification-group">
          <h2>Friend Requests</h2>

          {requests.map((request) => (
            <div
              key={request.id}
              className="notification-card"
            >
              <h3>
                {
                  request.sender
                    ?.uusername ||
                  request.sender
                    ?.username
                }
              </h3>

              <p>
                wants to be your friend
              </p>

              <div className="action-buttons">
                <button
                  onClick={() =>
                    acceptRequest(
                      request
                    )
                  }
                >
                  Accept
                </button>

                <button
                  onClick={() =>
                    rejectRequest(
                      request.id
                    )
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

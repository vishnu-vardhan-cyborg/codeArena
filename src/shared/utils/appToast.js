import { pushNotificationToast } from "./notificationCenter";

export const showAppToast = (message, tone = "success", title) => {
  const body = String(message || "").trim();

  if (!body) {
    return;
  }

  pushNotificationToast({
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: title || (tone === "error" ? "Action needed" : "CodeArena"),
    body,
    tone,
    dismissOnly: true,
  });
};

import { supabase } from "./supabase";

const getLocalDateKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const recordActivity = async ({
  userId,
  activityType,
  problemId = null,
  metadata = {},
}) => {
  if (!userId || !activityType) {
    return;
  }

  const { error } = await supabase.from("user_activity").insert({
    user_id: String(userId),
    activity_type: activityType,
    problem_id: problemId,
    activity_date: getLocalDateKey(),
    metadata,
  });

  if (error && error.code !== "PGRST205") {
    console.error("Activity tracking error:", error);
  }
};

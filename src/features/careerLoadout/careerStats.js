const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, Math.round(value)));

const toDayKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStreaks = (activityDays) => {
  const sortedDays = [...activityDays]
    .map((day) => new Date(`${day}T00:00:00`))
    .sort((first, second) => first - second);

  let longest = 0;
  let running = 0;
  let previous = null;

  sortedDays.forEach((day) => {
    if (previous && day - previous === DAY_MS) {
      running += 1;
    } else {
      running = 1;
    }
    longest = Math.max(longest, running);
    previous = day;
  });

  const activitySet = new Set(activityDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!activitySet.has(toDayKey(today))) {
    today.setDate(today.getDate() - 1);
  }

  let current = 0;
  while (activitySet.has(toDayKey(today))) {
    current += 1;
    today.setDate(today.getDate() - 1);
  }

  return { current, longest };
};

const getRankTitle = (level) => {
  if (level >= 25) return "Mythic Architect";
  if (level >= 15) return "Systems Vanguard";
  if (level >= 10) return "Algorithm Raider";
  if (level >= 5) return "Logic Ranger";
  if (level >= 2) return "Code Scout";
  return "Arena Initiate";
};

const getLanguageLoadout = (activity) => {
  const languageCounts = activity.reduce((counts, item) => {
    const language = item.metadata?.languageName?.trim();
    if (!language) return counts;
    counts[language] = (counts[language] || 0) + 1;
    return counts;
  }, {});
  const peak = Math.max(...Object.values(languageCounts), 1);

  return Object.entries(languageCounts)
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .slice(0, 6)
    .map(([name, runs], index) => ({
      name,
      runs,
      mastery: clamp(38 + (runs / peak) * 50 + Math.min(index, 2) * 2),
    }));
};

const getMomentum = (activity, weeks = 12) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(now);
  start.setDate(now.getDate() - weeks * 7 + 1);

  const values = Array.from({ length: weeks }, (_, index) => ({
    label: `W${index + 1}`,
    value: 0,
  }));

  activity.forEach((item) => {
    const activityDate = new Date(item.activity_date || item.created_at);
    const weekIndex = Math.floor((activityDate - start) / (DAY_MS * 7));
    if (weekIndex >= 0 && weekIndex < weeks) {
      values[weekIndex].value += 1;
    }
  });

  return values;
};

const getAchievements = ({
  xp,
  uniqueProblems,
  acceptedRuns,
  currentStreak,
  activeDays,
  languageCount,
  friendsCount,
  followersCount,
  postsCount,
}) => [
  {
    name: "First Deployment",
    detail: "Complete the first successful code run.",
    unlocked: acceptedRuns >= 1,
    progress: clamp(acceptedRuns * 100),
  },
  {
    name: "Polyglot Kit",
    detail: "Use three programming languages.",
    unlocked: languageCount >= 3,
    progress: clamp((languageCount / 3) * 100),
  },
  {
    name: "Streak Reactor",
    detail: "Maintain a seven-day coding streak.",
    unlocked: currentStreak >= 7,
    progress: clamp((currentStreak / 7) * 100),
  },
  {
    name: "Problem Hunter",
    detail: "Practice ten unique problems.",
    unlocked: uniqueProblems >= 10,
    progress: clamp((uniqueProblems / 10) * 100),
  },
  {
    name: "Signal Booster",
    detail: "Build a network of ten allies and followers.",
    unlocked: friendsCount + followersCount >= 10,
    progress: clamp(((friendsCount + followersCount) / 10) * 100),
  },
  {
    name: "Knowledge Drop",
    detail: "Share five valuable posts.",
    unlocked: postsCount >= 5,
    progress: clamp((postsCount / 5) * 100),
  },
  {
    name: "Arena Veteran",
    detail: "Reach 1,000 XP and thirty active days.",
    unlocked: xp >= 1000 && activeDays >= 30,
    progress: clamp(Math.min(xp / 1000, activeDays / 30) * 100),
  },
];

export const buildCareerStats = ({
  profile = {},
  activity = [],
  friendsCount = 0,
  followersCount = 0,
  followingCount = 0,
  postsCount = 0,
}) => {
  const xp = Number(profile.xp || 0);
  const level = Math.floor(xp / 100) + 1;
  const acceptedRuns = activity.filter((item) => {
    const status = item.metadata?.status?.toLowerCase();
    return !status || status === "accepted";
  }).length;
  const uniqueProblems = new Set(
    activity.map((item) => item.problem_id).filter(Boolean)
  ).size;
  const activityDays = [
    ...new Set(
      activity
        .map((item) => item.activity_date || item.created_at)
        .filter(Boolean)
        .map(toDayKey)
    ),
  ];
  const { current: currentStreak, longest: longestStreak } =
    getStreaks(activityDays);
  const languages = getLanguageLoadout(activity);
  const activeDays = activityDays.length;
  const communityScore = friendsCount + followersCount + followingCount;

  const axes = [
    {
      key: "logic",
      label: "Logic",
      value: clamp(uniqueProblems * 8 + acceptedRuns * 1.5),
    },
    {
      key: "execution",
      label: "Execution",
      value: clamp(acceptedRuns * 4),
    },
    {
      key: "consistency",
      label: "Consistency",
      value: clamp(activeDays * 3 + longestStreak * 6),
    },
    {
      key: "versatility",
      label: "Versatility",
      value: clamp(languages.length * 18 + uniqueProblems * 2),
    },
    {
      key: "influence",
      label: "Influence",
      value: clamp(communityScore * 5 + postsCount * 9),
    },
  ];

  const powerScore = clamp(
    axes.reduce((total, axis) => total + axis.value, 0) / axes.length
  );
  const achievements = getAchievements({
    xp,
    uniqueProblems,
    acceptedRuns,
    currentStreak,
    activeDays,
    languageCount: languages.length,
    friendsCount,
    followersCount,
    postsCount,
  });

  return {
    xp,
    level,
    rankTitle: getRankTitle(level),
    powerScore,
    nextLevelXp: 100 - (xp % 100),
    acceptedRuns,
    uniqueProblems,
    activeDays,
    currentStreak,
    longestStreak,
    friendsCount,
    followersCount,
    followingCount,
    postsCount,
    languages,
    axes,
    momentum: getMomentum(activity),
    achievements,
    unlockedAchievements: achievements.filter((item) => item.unlocked).length,
    recentMissions: activity.slice(0, 7).map((item) => ({
      id: item.id,
      title: item.problem_id
        ? item.problem_id
            .split("-")
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(" ")
        : item.activity_type || "Arena activity",
      language: item.metadata?.languageName || "CodeArena",
      status: item.metadata?.status || "Completed",
      createdAt: item.created_at || item.activity_date,
    })),
  };
};

export const buildRadarPoints = (axes, center = 120, radius = 82) =>
  axes
    .map((axis, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
      const distance = radius * (axis.value / 100);
      return `${center + Math.cos(angle) * distance},${
        center + Math.sin(angle) * distance
      }`;
    })
    .join(" ");

export const buildMomentumPoints = (
  momentum,
  width = 560,
  height = 160,
  padding = 18
) => {
  const peak = Math.max(...momentum.map((item) => item.value), 1);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return momentum
    .map((item, index) => {
      const x =
        padding +
        (index / Math.max(momentum.length - 1, 1)) * usableWidth;
      const y = height - padding - (item.value / peak) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");
};

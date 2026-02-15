const diffDays = (a, b) => {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcA - utcB) / (1000 * 60 * 60 * 24));
};

export const calculateStreak = (activeDates, today) => {
  const sorted = [...new Set(activeDates)].sort((a, b) => new Date(b) - new Date(a));
  if (!sorted.length) return 0;

  let streak = 0;
  let cursor = new Date(today);

  for (const isoDate of sorted) {
    const current = new Date(isoDate);
    const gap = diffDays(cursor, current);

    if (gap === 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (gap === 1) {
      streak += 1;
      cursor = new Date(current);
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

export const activityPoints = {
  leetcode: { easy: 10, medium: 18, hard: 30 },
  github: { low: 4, normal: 10, high: 15 },
  ctf: { easy: 12, medium: 20, hard: 35 }
};

export const scoreActivity = ({ platform, difficulty = "medium", quality = "normal" }) => {
  if (platform === "leetcode") {
    return activityPoints.leetcode[difficulty] ?? activityPoints.leetcode.medium;
  }
  if (platform === "github") {
    return activityPoints.github[quality] ?? activityPoints.github.normal;
  }
  if (platform === "ctf") {
    return activityPoints.ctf[difficulty] ?? activityPoints.ctf.medium;
  }
  return 0;
};

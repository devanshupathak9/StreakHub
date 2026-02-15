import "dotenv/config";
import cors from "cors";
import express from "express";
import pool from "./db.js";
import { calculateStreak, scoreActivity } from "./streak.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS daily_goals (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK (platform IN ('leetcode', 'github', 'ctf')),
      target_count INT NOT NULL DEFAULT 1,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, platform)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK (platform IN ('leetcode', 'github', 'ctf')),
      title TEXT NOT NULL,
      occurred_on DATE NOT NULL,
      difficulty TEXT,
      quality TEXT,
      points INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

app.get("/api/health", async (_req, res) => {
  const dbTime = await pool.query("SELECT NOW() AS now");
  res.json({ ok: true, dbTime: dbTime.rows[0].now });
});

app.post("/api/users", async (req, res) => {
  const { username, timezone = "UTC" } = req.body;
  if (!username) return res.status(400).json({ error: "username is required" });

  const user = await pool.query(
    `INSERT INTO users (username, timezone)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET timezone = EXCLUDED.timezone
     RETURNING *`,
    [username.trim().toLowerCase(), timezone]
  );

  res.status(201).json(user.rows[0]);
});

app.post("/api/goals", async (req, res) => {
  const { username, platform, targetCount = 1 } = req.body;
  if (!username || !platform) return res.status(400).json({ error: "username and platform are required" });

  const user = await pool.query("SELECT id FROM users WHERE username = $1", [username.trim().toLowerCase()]);
  if (!user.rows.length) return res.status(404).json({ error: "user not found" });

  const goal = await pool.query(
    `INSERT INTO daily_goals (user_id, platform, target_count)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, platform)
     DO UPDATE SET target_count = EXCLUDED.target_count, active = TRUE
     RETURNING *`,
    [user.rows[0].id, platform, targetCount]
  );

  res.status(201).json(goal.rows[0]);
});

app.post("/api/activity", async (req, res) => {
  const {
    username,
    platform,
    title,
    occurredOn,
    difficulty = "medium",
    quality = "normal"
  } = req.body;

  if (!username || !platform || !title || !occurredOn) {
    return res.status(400).json({ error: "username, platform, title and occurredOn are required" });
  }

  const user = await pool.query("SELECT id FROM users WHERE username = $1", [username.trim().toLowerCase()]);
  if (!user.rows.length) return res.status(404).json({ error: "user not found" });

  const points = scoreActivity({ platform, difficulty, quality });

  const activity = await pool.query(
    `INSERT INTO activity_logs (user_id, platform, title, occurred_on, difficulty, quality, points)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [user.rows[0].id, platform, title, occurredOn, difficulty, quality, points]
  );

  res.status(201).json(activity.rows[0]);
});

app.get("/api/dashboard/:username", async (req, res) => {
  const { username } = req.params;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const user = await pool.query("SELECT id, username, timezone FROM users WHERE username = $1", [username.trim().toLowerCase()]);
  if (!user.rows.length) return res.status(404).json({ error: "user not found" });

  const userId = user.rows[0].id;

  const [goals, todayStats, allActivityDays] = await Promise.all([
    pool.query("SELECT platform, target_count FROM daily_goals WHERE user_id = $1 AND active = TRUE", [userId]),
    pool.query(
      `SELECT platform, COUNT(*)::int AS completed, COALESCE(SUM(points), 0)::int AS points
       FROM activity_logs
       WHERE user_id = $1 AND occurred_on = $2
       GROUP BY platform`,
      [userId, date]
    ),
    pool.query(
      `SELECT DISTINCT occurred_on::text AS occurred_on
       FROM activity_logs
       WHERE user_id = $1
       ORDER BY occurred_on DESC`,
      [userId]
    )
  ]);

  const goalMap = new Map(goals.rows.map((g) => [g.platform, g.target_count]));
  const statMap = new Map(todayStats.rows.map((r) => [r.platform, r]));

  const platforms = ["leetcode", "github", "ctf"];
  const breakdown = platforms.map((platform) => {
    const target = goalMap.get(platform) ?? 0;
    const stat = statMap.get(platform) ?? { completed: 0, points: 0 };
    return {
      platform,
      target,
      completed: Number(stat.completed || 0),
      points: Number(stat.points || 0),
      met: target > 0 ? Number(stat.completed || 0) >= target : false
    };
  });

  const totalPoints = breakdown.reduce((sum, item) => sum + item.points, 0);
  const completedGoals = breakdown.filter((item) => item.target > 0 && item.met).length;
  const totalGoals = breakdown.filter((item) => item.target > 0).length;

  const streak = calculateStreak(
    allActivityDays.rows.map((r) => r.occurred_on),
    new Date(date)
  );

  res.json({
    user: user.rows[0],
    date,
    streak,
    totalPoints,
    completionRatio: totalGoals ? completedGoals / totalGoals : 0,
    breakdown
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });

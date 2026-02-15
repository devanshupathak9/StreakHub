import { useState } from "react";
import { api } from "./api";
import "./styles.css";

const initialGoal = { platform: "leetcode", targetCount: 1 };
const initialActivity = {
  platform: "leetcode",
  title: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  difficulty: "medium",
  quality: "normal"
};

function App() {
  const [username, setUsername] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [goal, setGoal] = useState(initialGoal);
  const [activity, setActivity] = useState(initialActivity);
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState("Create a user, set goals, and log activities.");

  const withFeedback = async (fn, successText) => {
    try {
      await fn();
      setMessage(successText);
      if (username) {
        const data = await api.getDashboard(username.toLowerCase());
        setDashboard(data);
      }
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <main className="page">
      <header>
        <h1>StreakHub PERN Starter</h1>
        <p>Track LeetCode, GitHub, and CTF progress in one streak dashboard.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>1) User</h2>
          <input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          <button
            onClick={() =>
              withFeedback(
                () => api.createUser({ username, timezone }),
                "User saved successfully."
              )
            }
          >
            Save User
          </button>
        </article>

        <article className="card">
          <h2>2) Daily Goal</h2>
          <select
            value={goal.platform}
            onChange={(e) => setGoal((prev) => ({ ...prev, platform: e.target.value }))}
          >
            <option value="leetcode">LeetCode</option>
            <option value="github">GitHub</option>
            <option value="ctf">CTF</option>
          </select>
          <input
            type="number"
            min="1"
            value={goal.targetCount}
            onChange={(e) => setGoal((prev) => ({ ...prev, targetCount: Number(e.target.value) }))}
          />
          <button
            onClick={() =>
              withFeedback(
                () => api.upsertGoal({ username, ...goal }),
                `Goal saved for ${goal.platform}.`
              )
            }
          >
            Save Goal
          </button>
        </article>

        <article className="card">
          <h2>3) Activity Log</h2>
          <select
            value={activity.platform}
            onChange={(e) => setActivity((prev) => ({ ...prev, platform: e.target.value }))}
          >
            <option value="leetcode">LeetCode</option>
            <option value="github">GitHub</option>
            <option value="ctf">CTF</option>
          </select>
          <input
            placeholder="title"
            value={activity.title}
            onChange={(e) => setActivity((prev) => ({ ...prev, title: e.target.value }))}
          />
          <input
            type="date"
            value={activity.occurredOn}
            onChange={(e) => setActivity((prev) => ({ ...prev, occurredOn: e.target.value }))}
          />
          <select
            value={activity.difficulty}
            onChange={(e) => setActivity((prev) => ({ ...prev, difficulty: e.target.value }))}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            value={activity.quality}
            onChange={(e) => setActivity((prev) => ({ ...prev, quality: e.target.value }))}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          <button
            onClick={() =>
              withFeedback(() => api.logActivity({ username, ...activity }), "Activity logged.")
            }
          >
            Log Activity
          </button>
        </article>
      </section>

      <p className="message">{message}</p>

      {dashboard && (
        <section className="card">
          <h2>Dashboard: @{dashboard.user.username}</h2>
          <p>
            Date: <strong>{dashboard.date}</strong> · Streak: <strong>{dashboard.streak}</strong> days ·
            Total Points: <strong>{dashboard.totalPoints}</strong>
          </p>
          <p>Completion: {(dashboard.completionRatio * 100).toFixed(0)}%</p>
          <ul>
            {dashboard.breakdown.map((item) => (
              <li key={item.platform}>
                {item.platform.toUpperCase()}: {item.completed}/{item.target} ({item.points} pts)
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default App;

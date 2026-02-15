# StreakHub System Design

## 1) Product Vision
StreakHub is a unified accountability platform that verifies and scores daily learning activity across:
- **LeetCode** (algorithm practice)
- **GitHub** (open-source contribution)
- **CTF platforms** (security practice)

The system converts fragmented activity into one schedule, one streak engine, and one social loop.

---

## 2) Objectives and Non-Objectives

### Objectives
1. Automatically verify daily activity from connected platforms.
2. Enforce configurable daily schedules and streak rules.
3. Provide social accountability via groups, leaderboards, and reminders.
4. Resist cheating via cross-validation and quality heuristics.
5. Support extensible integrations (new CTF providers, coding platforms).

### Non-Objectives (v1)
1. Building a full challenge-hosting platform (we only ingest completion data).
2. Replacing native platform analytics.
3. Providing realtime IDE/browser plugins.

---

## 3) User Personas
1. **Solo Builder**: Wants consistency and reminders across coding + CTF.
2. **Accountability Group Member**: Competes with peers and needs transparent streak proof.
3. **Mentor/Admin**: Manages private group rules and monitors participation.

---

## 4) Functional Requirements

### 4.1 Unified Daily Schedule
- Users define one or more goals, e.g.:
  - Solve 1 LeetCode problem/day.
  - Make 1 valid GitHub contribution/day.
  - Complete 1 CTF challenge/day.
- Support custom cadence:
  - Daily, weekdays-only, n-days/week.
  - Rest days (fixed or rolling).
  - Time-zone aware daily cutoff.
- Allow weighted goals (some goals contribute more to score).

### 4.2 Platform Integrations
- **GitHub**
  - OAuth for account linking.
  - Fetch commits/PRs/issues/reviews via GraphQL + webhook augmentation.
  - Detect low-effort commits.
- **LeetCode**
  - Use official endpoints where available; fallback to robust scraping worker.
  - Validate solved status and difficulty metadata.
- **CTF providers** (TryHackMe, Hack The Box, PicoCTF, custom adapter)
  - Provider adapters normalize challenge completion events.
  - API or scrape strategy per provider.

### 4.3 Streak Engine
- Per-activity streak (LeetCode streak, GitHub streak, CTF streak).
- Global streak (all required daily goals met).
- Rules:
  - Grace days (consumable credits).
  - Partial completion (weighted threshold, e.g. 70%).
  - Missed day recovery (optional token-based “repair”).
- Recompute deterministically from event history.

### 4.4 Social & Groups
- Create/join groups with invite links or codes.
- Group feed of verified daily completions.
- Leaderboards:
  - Daily score
  - Weekly consistency
  - Monthly streak rank
- Nudges:
  - Peer alerts when someone is close to losing a streak.

### 4.5 Scoring & Gamification
- Weighted points model:
  - LeetCode: difficulty multiplier (Easy/Medium/Hard).
  - GitHub: quality-adjusted commit/contribution points.
  - CTF: challenge category + difficulty + first-blood bonuses (optional).
- Levels, badges, milestone achievements.
- Weekly summary with trend insights.

### 4.6 Notifications
- Reminder windows before daily cutoff.
- “Risk of streak loss” alerts.
- Weekly recap.
- Delivery channels: in-app, email, push, Discord/Slack webhook (optional).

### 4.7 Anti-Cheat
- No manual check-in-only mode for verified streaks.
- Cross-check timestamps across platform APIs.
- GitHub low-effort detection:
  - Tiny or repetitive commits.
  - Automated commit bursts with suspicious patterns.
- CTF/LeetCode replay detection and duplicate-event suppression.

---

## 5) Non-Functional Requirements
1. **Correctness**: deterministic streak calculations with auditable event logs.
2. **Scalability**: support high fan-out ingestion (webhooks + scheduled pulls).
3. **Reliability**: retry, dead-letter queues, idempotent event processing.
4. **Security/Privacy**: OAuth token encryption, least-privilege scopes.
5. **Latency**: near real-time updates (<2 minutes p95 from event to dashboard).
6. **Observability**: full event tracing, integration health dashboards.

---

## 6) High-Level Architecture

```text
+-------------------+      +-----------------+
|  Web / Mobile UI  | <--> |  API Gateway    |
+-------------------+      +--------+--------+
                                   |
                    +--------------+--------------+
                    |                             |
          +---------v---------+         +---------v----------+
          | Auth & User Svc   |         | Schedule/Streak Svc|
          +---------+---------+         +----+---------------+
                    |                        |
                    |                        |
          +---------v------------------------v----------------+
          |                 Event Bus (Kafka/SQS)             |
          +----+----------------+----------------+------------+
               |                |                |
     +---------v----+  +--------v--------+ +-----v-----------+
     | LeetCode Ing.|  | GitHub Ingestion| | CTF Ingestion   |
     | (API/Scrape) |  | (Webhook+Pull)  | | (Adapters)      |
     +---------+----+  +--------+--------+ +-----+-----------+
               |                |                |
               +----------------+----------------+
                                |
                      +---------v---------+
                      | Normalization Svc |
                      +---------+---------+
                                |
                      +---------v---------+
                      | Verification Svc  |
                      +---------+---------+
                                |
          +---------------------v----------------------+
          | PostgreSQL + Timeseries + Redis + Object  |
          +---------------------+----------------------+
                                |
                      +---------v---------+
                      | Notification Svc  |
                      +-------------------+
```

### Service Responsibilities
- **API Gateway/BFF**: GraphQL or REST facade for clients.
- **Auth Service**: identity, OAuth linking, token refresh.
- **Ingestion Services**: provider-specific fetch/webhook intake.
- **Normalization Service**: convert provider payloads into canonical events.
- **Verification Service**: anti-cheat heuristics + confidence scoring.
- **Schedule/Streak Service**: rule evaluation and streak state machine.
- **Scoring Service** (can be combined with streak service in v1): points + badges.
- **Notification Service**: reminder orchestration.

---

## 7) Data Model (Core Entities)

1. **users**
   - id, email, timezone, profile, notification_preferences
2. **connected_accounts**
   - user_id, provider, provider_user_id, oauth_tokens_encrypted, status
3. **goals**
   - user_id, provider_type, target_count, cadence, weight, active_from/to
4. **activity_events (immutable)**
   - event_id, user_id, provider, external_id, occurred_at, payload, ingest_source
5. **verified_activities**
   - event_id, verification_status, confidence_score, reasons
6. **daily_rollups**
   - user_id, date, provider_stats, total_score, completion_ratio
7. **streak_states**
   - user_id, provider, current_streak, longest_streak, grace_balance, updated_at
8. **groups / group_members**
   - group metadata, membership role, join status
9. **leaderboard_snapshots**
   - period, group_id, rankings_json
10. **achievements**
    - badge_id, user_id, unlocked_at

Design principle: event sourcing for core activity + materialized views for fast reads.

---

## 8) Canonical Event Contract

```json
{
  "event_id": "uuid",
  "user_id": "uuid",
  "provider": "leetcode|github|tryhackme|htb|picoctf",
  "activity_type": "problem_solved|commit|pr_merged|challenge_completed",
  "external_ref": "provider_event_id",
  "occurred_at": "2026-02-15T17:03:42Z",
  "metadata": {
    "difficulty": "medium",
    "repo": "owner/repo",
    "lines_changed": 42,
    "ctf_category": "web"
  },
  "ingested_at": "2026-02-15T17:04:10Z",
  "signature": "hash_for_dedup"
}
```

---

## 9) Verification and Anti-Cheat Strategy

### 9.1 Event Integrity
- Idempotency key = provider + external_ref + user.
- Reject duplicates and stale out-of-window events.
- Maintain provider raw payload for audit.

### 9.2 GitHub Quality Heuristics
- Minimum meaningful delta threshold (changed files/LOC with allowlist exceptions).
- Penalize repetitive commit messages across short windows.
- Discount bot-only commits unless explicitly allowed.
- Optional PR-linked scoring boost over raw commit count.

### 9.3 LeetCode Validation
- Verify accepted submission status and unique problem/day constraints.
- Difficulty lookup from authoritative catalog.
- Ignore resubmissions that do not satisfy uniqueness rule.

### 9.4 CTF Validation
- Provider-specific completion API verification.
- Deduplicate same challenge solves.
- Optional decay score for very old retired challenges.

### 9.5 Confidence Scoring
Each verified event receives confidence [0,1] from:
- Source trust (official API > scrape)
- Payload completeness
- Behavior anomaly checks

Events below threshold can count as “pending” until revalidated.

---

## 10) Streak Engine Rules

### Daily Evaluation Steps
1. Determine user-local day boundaries using timezone.
2. Load active goals for that date.
3. Aggregate verified events by provider and goal type.
4. Compute per-goal completion and weighted completion ratio.
5. Apply rule policy:
   - If ratio == 1.0: day success
   - Else if ratio >= partial_threshold: partial success (if enabled)
   - Else if grace available: consume grace and mark protected
   - Else: miss day
6. Update provider and global streak states atomically.

### Recovery
- Optional recovery token usable within N days.
- Recovery marks day as repaired, but stores audit flag to prevent abuse.

### Determinism
- Streak is recomputable from immutable events + immutable rule snapshots.

---

## 11) Scoring Model (Initial)

### Base Point Formula
`score = base(activity_type) * difficulty_multiplier * quality_multiplier * streak_bonus`

Examples:
- LeetCode Easy/Medium/Hard multipliers: 1.0 / 1.8 / 3.0
- GitHub quality multiplier:
  - low effort: 0.2
  - normal: 1.0
  - high impact (PR merged + review): 1.5
- CTF difficulty multipliers: 1.2 / 2.0 / 3.5

### Streak Bonus
- +2% per consecutive day up to 30% cap.

### Group Ranking Metric
- Weighted blend:
  - 50% consistency score
  - 30% current streak length
  - 20% challenge difficulty points

---

## 12) API Design (Representative)

### Auth & Connections
- `POST /auth/github/connect`
- `POST /auth/leetcode/connect`
- `POST /auth/ctf/{provider}/connect`

### Goals & Schedule
- `POST /goals`
- `GET /goals`
- `PATCH /goals/{goalId}`
- `POST /schedule/rest-days`

### Activity & Verification
- `GET /activity/daily?date=YYYY-MM-DD`
- `GET /activity/history?from=&to=`
- `GET /verification/events/{eventId}`

### Streaks & Scores
- `GET /streaks`
- `GET /scores/daily`
- `GET /analytics/calendar`

### Groups
- `POST /groups`
- `POST /groups/{groupId}/invite`
- `GET /groups/{groupId}/leaderboard?period=weekly`

### Notifications
- `POST /notifications/preferences`
- `POST /notifications/test`

---

## 13) Scheduler and Job Topology
1. **Webhook path** (GitHub primary): low-latency event ingestion.
2. **Polling path** (LeetCode/CTF fallback): periodic sync jobs.
3. **Daily close job** per timezone bucket:
   - finalize day completion
   - emit reminder/escalation events near cutoff
4. **Repair jobs**:
   - delayed verification retries
   - token refresh + backfill
5. **Leaderboard compaction jobs**:
   - precompute daily/weekly/monthly standings.

---

## 14) Security, Compliance, and Privacy
- Store OAuth tokens encrypted at rest (KMS-backed envelope encryption).
- Strict scope minimization (read-only activity scopes where possible).
- Signed webhook verification for GitHub.
- Audit logs for account linking, streak state changes, and admin actions.
- Data retention controls and account deletion workflows.

---

## 15) Observability and SRE
- Metrics:
  - ingestion lag, verification success rate, streak recompute latency
  - reminder delivery success, anti-cheat flag rate
- Tracing:
  - trace-id propagated from ingestion to streak update
- Alerting:
  - provider API outage detection
  - queue backlog thresholds
- Runbooks:
  - token expiration spikes
  - scraper breakage mitigation

---

## 16) Rollout Plan

### Phase 1 (MVP)
- GitHub + LeetCode integration
- Basic CTF adapter (one provider)
- Daily goals, streaks, reminders
- Private groups and weekly leaderboard

### Phase 2
- Multi-CTF adapters, advanced anti-cheat heuristics
- Badges/levels, richer analytics calendar
- Discord/Slack integrations

### Phase 3
- Predictive coaching (best reminder times)
- Team plans and mentor dashboards
- Public API / plugin ecosystem

---

## 17) Key Risks and Mitigations
1. **Unofficial or unstable APIs (LeetCode/CTF)**
   - Mitigation: adapter abstraction + fallback polling/scraping + synthetic monitoring.
2. **False positives in anti-cheat**
   - Mitigation: confidence scoring, transparent reasons, appeal/review flow.
3. **Timezone and cutoff confusion**
   - Mitigation: explicit local-day previews and “today closes in Xh Ym” UI cues.
4. **Notification fatigue**
   - Mitigation: adaptive reminder frequency and quiet hours.

---

## 18) Success Metrics
- D1/D7/D30 retention for connected users.
- % of users maintaining 7+ day streak.
- Average verified activities/user/week.
- Group engagement rate (leaderboard views, nudges sent).
- Streak loss prevention rate after risk alerts.

This architecture provides a practical MVP path while preserving extensibility, auditability, and anti-cheat integrity.

# 08 — Ranking

**Owner:** Dev B (after SW-05)
**Owned paths:** `src/lib/ranking`
**Depends on:** SW-05; RK-03 needs AI-01
**Can start with fixtures?** Yes for RK-01/02 (pure functions over fixtures)

- [x] RK-01 (PR #7) ⚡ Feature extraction per paper (topics, keywords from title, year bucket, venue type) + tests
- [ ] RK-02 ⚡ Online weights from swipes (simple +/− per feature with decay); re-rank queue after ≥ 6 swipes
- [ ] RK-03 Insight toast: SMART model turns top negative/positive features into one sentence ("You keep skipping survey papers — hide them?") with one-tap apply → adds filter
- [ ] RK-04 Group mode: rank by combined weights

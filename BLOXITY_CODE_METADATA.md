---
canDie: false
hasScore: true
---

# +1 Be Tornado: Boxity integration

The player cannot die: there is no death or game-over screen. You are a tornado: sweep
through a city and everything small enough for your level flies into your funnel for
Power. Power fills your level; every few levels your tornado grows a ring (wider, taller,
swallows more at once). Hold your funnel over a city's Giant Trophies and its Landmark to
tear them up for Wins. Wins buy stronger tornadoes (20 types, each a Power multiplier),
upgrades, eggs and passes. New levels open the next city's gate: 20 cities, one after
another along a chain of islands. At max level, rebirth (15 + 8 levels per rebirth, x1
more Power each) - the tornado shrinks back and grows again, faster.

Inside the code a few template names stay (`health` is Power, a `pad` is a Storm Zone).

## How it runs (and why it scales)

- **The server decides what you absorb.** Every city's layout comes from a seeded random
  (`shared/cities.js`), so the server and every client build the same objects with the
  same ids. The server sweeps each tornado's reported path against it every tick
  (`shared/session.js`); clients only predict it for show. No object is ever sent over the
  network, and nothing a client says can make it absorb something.
- **Every player has their own copy of every city** (their own respawn timers): nobody
  steals anybody's trophies, and there is no per-object shared state to sync.
- **Small rooms, many pods.** A room holds 8 (`MAX_CLIENTS`, and `SEAT_CAP` in the deploy
  workflow); the synced state is only what others need to draw you (position, tornado type
  and radius, look, pets). A server tick costs ~0.03 ms per player (see the last test in
  `server/test/rules.test.js`), so a pod holds many rooms and Legion's matchmaker starts more
  as players arrive.

## Leaderboards

Scores are reported by the **game server**, never by the client
(`server/src/bloxityLeaderboards.js`, `BLOXITY_LEADERBOARDS`). Every ~20 s and when a
player leaves, each pod sends the changed scores of its verified players to
`POST {api}/v1/leaderboards/hosted/{BLOXITY_GAME_ID}/report` as `legion_<userId>`.

| Board       | Label            | Score                                | Format  |
|-------------|------------------|--------------------------------------|---------|
| `rebirths`  | Rebirths         | `profile.rebirths`                   | number  |
| `wins`      | Total Wins       | `profile.stats.totalWins`            | compact |
| `destroyed` | Things Destroyed | `profile.stats.absorbed`             | compact |
| `playtime`  | Minutes Played   | `floor(profile.stats.playtime / 60)` | number  |

All four are `order: desc`, `mode: best`, `reset: none`.

## Gems purchases

Boxity's purchase webhook goes to `POST /api/gems/webhook` on the game server. It is
recorded in the database by `transactionId` (idempotent) and applied exactly once by
the pod the buyer plays on. Unknown skus are answered 400 so Boxity refunds them. The skus
are in `shared/balance.js` `GEM_PRODUCTS` (`wins_small`, `wins_big`, `potion_bundle`,
`volcano_eggs`, `big_storm`, `health_x2`, `wins_x2`, `pad_best`): each must exist in the
game's Boxity catalog.

## Rewarded ads

The client sends `adReward { placement, rewardToken }`; the server verifies the token
with `POST {api}/v1/ads/reward/verify` before granting anything.

## Open Rooms

Each pod reports its rooms every 2 s to `POST {MATCHMAKER_REPORT_URL}/{BLOXITY_GAME_ID}/rooms`
(`server/src/legionRoomReporter.js`, installed after `listen()`), so they show under
"Open Rooms" on the game page. The client joins `?roomId=` at launch and falls back to
normal matchmaking if that room is gone or full.

## Avatars

`client/src/game/PlayerAvatar.jsx` + `avatarRig.js` draw every slot: skin (with face,
shirt and pants), body parts, hat + hair + mask on `Neck1`, back on `Spine2`, neck/chest
on `Spine2` and waist on `Spine1` (rest-inverse placement), hands and shoes as mirrored
pairs following the leaf bones' position and rotation only. Your avatar rides inside your
tornado, whirled round and flailing (`playerPose.js` `riding`); other players' ride in
theirs (the nearest few as their real avatar, the rest as a blocky figure). A player
wearing an uploaded character (`characterId`) gets its GLB via `avatar.getCharacter()` /
`getCharacterFor()`, with accessories fitted by `characterAccessoryMatrix`; on any failure
the regular avatar shows.

## Server environment

| Variable                | Purpose                                                       |
|-------------------------|---------------------------------------------------------------|
| `BLOXITY_REPORT_TOKEN`  | Token for leaderboard and room reports (none set = no reports) |
| `MATCHMAKER_REPORT_URL` | Where the Open Rooms reporter posts (injected by Boxity hosting) |
| `BLOXITY_GAME_ID`       | Hosted game id for reports (default `1-be-tornado`)              |
| `LEGION_WEBHOOK_SECRET` | Must match the webhook's `x-legion-webhook-secret` header     |
| `MONGODB_URI`           | Shared database for profiles and Gems grants (SQLite without) |
| `BLOXITY_API_URL` etc.  | Platform URLs; production defaults (`server/src/bloxityEnv.js`) |

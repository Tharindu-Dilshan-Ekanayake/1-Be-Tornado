/**
 * Writes docs/game-guide-si.html: the game explained in Sinhala, with every number taken
 * from shared/balance.js and the pacing from a 24-hour run of scripts/balance-sim.mjs, so
 * the guide can never drift from the game. Run it again after any balance change:
 *
 *   node scripts/gen-guide.mjs
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  EGGS,
  healthForLevel,
  PAY_SHARE,
  LEVEL_PACKS,
  levelCap,
  objectLevel,
  PADS,
  RARITIES,
  rebirthMultiplier,
  RING_LEVELS,
  SHOP,
  SIZES,
  TEAR_FASTEST,
  TEAR_SLOWEST,
  TOUGH_STEP,
  STAGES,
  TORNADOES,
  upgradeCost,
  UPGRADES,
} from '../shared/balance.js'
import { payStep, stageLayout } from '../shared/cities.js'
import { formatNumber } from '../shared/format.js'

const root = fileURLToPath(new URL('..', import.meta.url))
console.log('Running the 24-hour simulation (about a minute)...')
const sim = JSON.parse(execFileSync(process.execPath, ['scripts/balance-sim.mjs', '24', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n').pop())

/** "1 පැ. 4 මි." / "12 මි." / "40 ත." */
const when = (s) => {
  if (s === undefined) return '24 පැ.+'
  if (s < 60) return `${s} ත.`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h} පැ. ${m} මි.` : `${m} මි.`
}
const n = (v) => formatNumber(v)
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')

const stageRows = STAGES.map((s, i) => {
  const lm = objectLevel(i, 'landmark')
  return `<tr><td class="n">${i + 1}</td><td>${esc(s.name)}<span class="sub">${s.theme}</span></td><td class="n">${s.level}</td><td class="n">${n(s.wins)}</td><td class="n">${payStep(i)} / ${stageLayout(i).objects.length}</td><td>${esc(s.landmark.name)}<span class="sub">ශක්තිය ${lm}</span></td><td class="n">x${n(s.power)}</td><td class="n">${i === 0 ? 'ආරම්භය' : when(sim.cities[i])}</td></tr>`
}).join('\n')

const tornadoRows = TORNADOES.map((t, i) => {
  const r = RARITIES[t.rarity]
  return `<tr><td class="n">${i + 1}</td><td><span class="dot" style="background:${t.colors[1]}"></span>${esc(t.name)}</td><td><span class="pill" style="background:${r.color}">${r.name}</span></td><td class="n">x${t.power}</td><td class="n">${t.cost ? n(t.cost) : 'නොමිලේ'}</td><td class="n">${i === 0 ? '-' : when(sim.tornadoes[t.id])}</td></tr>`
}).join('\n')

const rebirthRows = [0, 1, 2, 3, 5, 8, 10, 13, 15, 19, 20, 25]
  .map((r) => `<tr><td class="n">R${r}</td><td class="n">${levelCap(r)}</td><td class="n">${n(healthForLevel(levelCap(r)))}</td><td class="n">x${rebirthMultiplier(r)}</td><td class="n">${r === 0 ? '-' : when(sim.rebirths[r])}</td></tr>`)
  .join('\n')

const sizeRows = Object.entries(SIZES)
  .map(([id, s]) => `<tr><td>${id}</td><td class="n">${s.power}</td><td class="n">${Math.round(s.lvl * 100)}%</td><td class="n">${s.r} m</td><td class="n">${s.hp} ත.</td><td class="n">${s.respawn} ත.</td></tr>`)
  .join('\n')

const upgradeRows = Object.entries(UPGRADES)
  .map(([id, u]) => `<tr><td>${esc(u.name)}</td><td>${esc(u.blurb)}</td><td class="n">${u.max}</td><td class="n">${n(upgradeCost(id, 0))}</td><td class="n">${n(upgradeCost(id, 4))}</td><td class="n">${n(upgradeCost(id, u.max - 1))}</td></tr>`)
  .join('\n')

const html = `<!doctype html>
<html lang="si">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>+1 Be Tornado ගේම් මාර්ගෝපදේශය</title>
<style>
:root { --bg: #f4f6fb; --panel: #ffffff; --ink: #1d2033; --muted: #5d627d; --accent: #2f8ff2; --accent2: #ff7a1e; --line: #dde2ef; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #13151f; --panel: #1d2030; --ink: #eceef8; --muted: #a3a8c4; --accent: #6fb4ff; --accent2: #ff9a4a; --line: #30344a; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #13151f; --panel: #1d2030; --ink: #eceef8; --muted: #a3a8c4; --accent: #6fb4ff; --accent2: #ff9a4a; --line: #30344a; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: 'Noto Sans Sinhala', system-ui, sans-serif; font-size: 16px; line-height: 1.7; }
main { max-width: 1080px; margin: 0 auto; padding: 28px 16px 64px; display: flex; flex-direction: column; gap: 20px; }
h1 { font-size: clamp(28px, 5vw, 42px); line-height: 1.15; margin: 0; }
header p { color: var(--muted); max-width: 72ch; }
section { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 18px 18px 20px; }
h2 { font-size: 23px; margin: 0 0 8px; }
h2 .no { color: var(--accent2); margin-right: 8px; }
p, li { max-width: 76ch; }
.tbl { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; margin-top: 10px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { background: color-mix(in srgb, var(--accent) 12%, var(--panel)); white-space: nowrap; position: sticky; top: 0; }
td.n { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
.sub { display: block; color: var(--muted); font-size: 12px; }
.pill { display: inline-block; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 700; color: #fff; }
.dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 7px; border: 1px solid #0003; vertical-align: -1px; }
.loop { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.loop span { background: color-mix(in srgb, var(--accent) 14%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 999px; padding: 3px 12px; font-weight: 600; }
.note { border-left: 4px solid var(--accent2); padding: 6px 12px; background: color-mix(in srgb, var(--accent2) 9%, transparent); border-radius: 0 8px 8px 0; }
code { font-size: 13px; background: color-mix(in srgb, var(--ink) 8%, transparent); padding: 1px 5px; border-radius: 5px; }
</style>
</head>
<body>
<main>
<header>
<h1>+1 Be Tornado – ගේම් එකේ සම්පූර්ණ විස්තරය</h1>
<p>ගේම් එක වැඩ කරන හැටි, නගර (stages) 20, හැම නගරයකම Wins, tornado මිල, rebirth, upgrades සහ player කෙනෙක් කොච්චර වෙලාවකින් මොනවා ලබනවද කියන එක. අංක ඔක්කොම <code>shared/balance.js</code> එකෙන්; කාලය බොට් කෙනෙක් පැය 24ක් සෙල්ලම් කරවලා (<code>scripts/balance-sim.mjs</code>, pets/passes නැතුව). මේ file එක <code>node scripts/gen-guide.mjs</code> එකෙන් හැදෙන්නේ.</p>
</header>

<section>
<h2><span class="no">1</span>ගේම් එක</h2>
<div class="loop"><span>නගරයට යනවා</span>→<span>පොඩි දේවල් tornado එකට උරා ගන්නවා</span>→<span>Power → Level</span>→<span>Rings වැඩි වෙලා tornado එක ලොකු වෙනවා</span>→<span>දේවල් ගොඩක් කැඩුවාම → Wins</span>→<span>අලුත් tornado / upgrades</span>→<span>ඊළඟ නගරයේ gate එක ඇරෙනවා</span>→<span>Max level → Rebirth</span></div>
<ul>
<li>ඔයාගේ level එකට වඩා ලොකු දේවල් උරාගන්න බෑ (ඒවා ගැස්සෙනවා, "Level 12" කියලා පෙන්නනවා). පොඩි දේවල් (tiny) නගරයේ level එකෙන්ම; ලොකු ඒවා (houses, towers) ඊළඟ නගරයේ level එකට කිට්ටුව.</li>
<li>නගරයක දේවල් ටිකක් (ඒ නගරයේ දේවල්වලින් ${Math.round(PAY_SHARE * 100)}%ක් තරම් ගාණක්: Stage 1 දී ${payStep(0)}ක්) කඩන හැම වතාවකම ඒ නගරයේ Wins ලැබෙනවා (Stage 1 = 3, Stage 2 = 7 …): ටිකක් කැඩුවත් Wins. කඩපු දේවල් ටික වෙලාවකින් ආයෙත් එනවා, ඒවා ආයෙත් කැඩුවත් ගණන් වෙනවා.</li>
<li>Giant Trophy සහ Landmark කියන්නේ නගරයේ ලොකුම දේවල්: ගොඩක් Power, කඩන්න තත්පර කීපයක් යනවා (ශක්තිමත් tornado එකක් ඉක්මනට කඩනවා).</li>
<li>නතර නොවී උරාගත්තොත් streak එක (x2, x3…) වැඩි වෙලා Power +2% බැගින් (උපරිම +50%).</li>
<li>SURGE බොත්තම (Space): ළඟ තියෙන ඔක්කොම එකපාරට; Giant Trophy/Landmark එකකින් අඩක් කඩනවා. Cooldown තත්පර 24 (upgrade කළොත් අඩු වෙනවා).</li>
<li>Level ${RING_LEVELS.join(', ')} වලදී අලුත් ring එකක් (උපරිම 10): tornado එක පළල් වෙලා එකපාරට වැඩිපුර උරනවා. Rebirth කළාම level 1 නිසා tornado එක ආයෙත් පොඩි වෙනවා.</li>
<li>හැම player කෙනෙක්ටම නගරවල තමන්ගේම පිටපතක්: කවුරුත් ඔයාගේ නගරය විනාශ කරන්නේ නෑ. Server එක තමයි මොනවා උරාගත්තද කියලා තීරණය කරන්නේ (cheat කරන්න බෑ).</li>
</ul>
</section>

<section>
<h2><span class="no">2</span>නගර 20 – Level, Wins</h2>
<p>Gate level = ඒ නගරයට යන්න ඕනෙ level (එකපාරක් ඇරුනාම සදහටම ඇරිලා). Wins = ඒ නගරයේ 'Wins එකකට කඩන්න ඕනෙ' ගාණක් දේවල් කඩන හැම වතාවකම ලැබෙන Wins. Power = ඒ නගරයේ දේවල්වල Power ගුණකය.</p>
<div class="tbl"><table><thead><tr><th>#</th><th>නගරය</th><th>Gate level</th><th>Wins</th><th>Wins එකකට කඩන්න ඕනෙ දේවල් / මුළු</th><th>Landmark</th><th>Power</th><th>බොට්: ඇරුනේ</th></tr></thead><tbody>
${stageRows}
</tbody></table></div>
<p class="note">Level cap එක 15 + 8 × rebirths නිසා නගර 1–3 R0 දී, නගරය 4 ට R1, … අන්තිම නගරයට R19 ඕනෙ.</p>
</section>

<section>
<h2><span class="no">3</span>Tornado වර්ග 20</h2>
<p>Power = හැම Power gain එකකම ගුණකය. පිළිවෙලට ගන්න ඕනෙ (Types menu එකෙන් හෝ lobby එකේ stand එකට ගිහින්). හැම එකක්ම ඒ වෙලාවේ ඉන්න නගරයේ trophies විනාඩි කීපයක Wins.</p>
<div class="tbl"><table><thead><tr><th>#</th><th>Tornado</th><th>Rarity</th><th>Power</th><th>මිල (Wins)</th><th>බොට් ගත්ත කාලය</th></tr></thead><tbody>
${tornadoRows}
</tbody></table></div>
</section>

<section>
<h2><span class="no">4</span>Rebirth (ඔයාගේ system එක, වෙනස් කළේ නෑ)</h2>
<p>Max level = 15 + 8 × rebirths. Power ගුණකය = 1 + rebirths. Rebirth කළාම Power සහ level බිංදුව; Wins, tornadoes, upgrades, pets, ඇරපු නගර ඔක්කොම තියෙනවා. Skip (Wins වලින්), Auto Rebirth, R15 ඉඳන් හැම 5කටම Volcano Eggs.</p>
<div class="tbl"><table><thead><tr><th>Rebirth</th><th>Max level</th><th>ඒ level එකට Power</th><th>Power ගුණකය</th><th>බොට් කාලය</th></tr></thead><tbody>
${rebirthRows}
</tbody></table></div>
</section>

<section>
<h2><span class="no">5</span>නගරවල දේවල්</h2>
<p>නගරයක් ඇතුළේ කිසිම දේකට level එකක් ඕනෙ නෑ: ඕනෙම tornado එකකට ඕනෙම දෙයක් කඩන්න පුළුවන්, වෙනස කඩන වේගය විතරයි. Power = මූලික Power (නගරයේ Power ගුණකයෙන් ගුණ වෙනවා). ශක්තිය = ඒ දේ කොච්චර ශක්තිමත්ද (0% = gate level, 100% = ඊළඟ නගරයේ gate level). ඔයාගේ ශක්තිය = ඔයාගේ level + tornado වර්ගයේ ශක්තිය (Power ගුණකයේ log2: x8 tornado එකක් = level 3ක් වැඩිපුර). ඔයා ඒ දේට වඩා level ${TOUGH_STEP}කින් ශක්තිමත් වෙන හැම වතාවකම කඩන වේගය දෙගුණයි, අඩු නම් හෙමින් (ඉක්මනම ${TEAR_FASTEST}x, හෙමින්ම 1/${Math.round(1 / TEAR_SLOWEST)}). HP = ඔයා ඒ දේ තරම්ම ශක්තිමත් නම් tornado එක උඩ තියාගෙන ඉන්න ඕනෙ තත්පර. කැඩුවාම ඒ දේ ආයෙත් එන්නේ 'ආයෙත් එන්නේ' තත්පර ගාණකට පස්සේ.</p>
<div class="tbl"><table><thead><tr><th>ප්‍රමාණය</th><th>Power</th><th>ශක්තිය</th><th>පළල</th><th>HP</th><th>ආයෙත් එන්නේ</th></tr></thead><tbody>
${sizeRows}
</tbody></table></div>
</section>

<section>
<h2><span class="no">6</span>Upgrades, Packs, Shop, Eggs</h2>
<div class="tbl"><table><thead><tr><th>Upgrade</th><th>කරන දේ</th><th>උපරිම</th><th>Level 1</th><th>Level 5</th><th>අන්තිම</th></tr></thead><tbody>
${upgradeRows}
</tbody></table></div>
<p>Level packs (+${LEVEL_PACKS.map((p) => p.levels).join(' / +')} levels): ඔයාගේ හොඳම නගරයේ Wins ${LEVEL_PACKS.map((p) => p.pays).join(' / ')} වතාවක ගාණ (max level එකෙන් එහාට යන්නේ නෑ).</p>
<p>Shop: ${Object.values(SHOP).map((s) => `${esc(s.name)} ${n(s.price)}`).join(' • ')}.</p>
<p>Eggs: ${Object.values(EGGS).map((e) => `${esc(e.name)} ${n(e.cost.wins)}`).join(' • ')}. Storm Zones (lobby එකේ, ඇතුලේ හිටියම Power): ${PADS.map((p) => `x${p.mult}`).join(', ')}.</p>
</section>

<section>
<h2><span class="no">7</span>High CCU</h2>
<ul>
<li>Room එකකට 8යි; Legion matchmaker එක පිරෙනකොට අලුත් room/pod පටන් ගන්නවා.</li>
<li>Objects network එකේ යවන්නේ නෑ: server/client දෙකම එකම seed එකෙන් නගරය හදනවා. Server එක ලබන්නේ position විතරයි, එයාම තීරණය කරනවා උරාගත්ත දේ.</li>
<li>Player කෙනෙක්ට server tick එකක් ~0.03 ms. Sync state එකේ තියෙන්නේ අනිත් අයට ඔයාව අඳින්න ඕනෙ දේවල් විතරයි (Power/Wins නෑ).</li>
</ul>
</section>
</main>
</body>
</html>
`

writeFileSync(new URL('../docs/game-guide-si.html', import.meta.url), html)
console.log('Wrote docs/game-guide-si.html')

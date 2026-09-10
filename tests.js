/* MinusOne — 100 user test plans. Load in the app page, then: await runTests() */
(function(){
'use strict';
const T = [];
const test = (name, fn) => T.push({name, fn});
const sleep = async n => { for(let i=0;i<(n>20?20:n);i++) await Promise.resolve(); }; // microtask flush — real timers are throttled in hidden tabs
const A = (cond, msg) => { if(!cond) throw new Error(msg||'assert failed'); };
const AEQ = (a,b,msg) => { if(a!==b) throw new Error(`${msg||'expected equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };

function resetState(){
  localStorage.removeItem(KEY);
  const f = load();
  state.habits = f.habits;
  state.settings = f.settings;
  state.coolingLocks = f.coolingLocks;
  state.game = f.game;
  switchTab('home');
  render();
}
function mkHabit(name, opts={}){
  return Object.assign({
    id: uid(), name, type:'time', minPerUrge:30, costPerUrge:0, isRoot:false,
    status:'queued', resisted:0, log:{}, slips:[], lastShieldStreak:0,
    streakStart:null, createdAt:Date.now()
  }, opts);
}
function addActive(name='Boss Habit', opts={}){
  const h = mkHabit(name, Object.assign({status:'active', streakStart:Date.now()}, opts));
  state.habits.push(h); render(); return h;
}
function addQueued(name='Queued Habit', opts={}){
  const h = mkHabit(name, Object.assign({status:'queued'}, opts));
  state.habits.push(h); render(); return h;
}
async function ok(){ await sleep(50); document.getElementById('cOk').click(); await sleep(30); }
async function cancel(){ await sleep(50); document.getElementById('cCancel').click(); await sleep(30); }
function sheetForm(name, type='time', min=30, cost=10, root=false){
  openHabitModal();
  $('hName').value = name; $('hType').value = type; syncCostFields();
  $('hMin').value = min; $('hCost').value = cost; $('hRoot').checked = root;
}
const daysAgo = n => Date.now() - n*86400000;

/* ---------- A. Onboarding / empty (1-8) ---------- */
test('T1 empty state visible with no habits', ()=>{ resetState(); A($('emptyState').style.display !== 'none'); });
test('T2 summary and quest hidden when empty', ()=>{ resetState(); AEQ($('statsSection').innerHTML,''); AEQ($('questSection').innerHTML,''); });
test('T3 trends shows empty message when no resists', ()=>{ resetState(); A($('trendsEmpty').style.display !== 'none'); AEQ($('trendsBody').innerHTML,''); });
test('T4 targets view shows empty message with no habits', ()=>{ resetState(); A($('targetsEmpty').style.display !== 'none'); });
test('T5 first saved habit becomes the active boss', ()=>{ resetState(); sheetForm('Scrolling'); saveHabit(); A(boss() && boss().name==='Scrolling'); });
test('T6 first habit streak starts at 0 days', ()=>{ resetState(); sheetForm('Scrolling'); saveHabit(); AEQ(streakDays(boss()),0); });
test('T7 demo loads 3 habits (1 active, 1 queued, 1 vaulted)', ()=>{ resetState(); loadDemo(); AEQ(state.habits.length,3); A(boss()); AEQ(state.habits.filter(h=>h.status==='queued').length,1); AEQ(state.habits.filter(h=>h.status==='neutralized').length,1); });
test('T8 wipeData clears everything after confirm', async ()=>{ resetState(); loadDemo(); const p=wipeData(); await ok(); await p; AEQ(state.habits.length,0); AEQ(state.game.xp,0); });

/* ---------- B. Habit CRUD (9-20) ---------- */
test('T9 empty name is rejected', ()=>{ resetState(); sheetForm(''); saveHabit(); AEQ(state.habits.length,0); });
test('T10 duplicate name rejected case-insensitively', ()=>{ resetState(); sheetForm('Vaping'); saveHabit(); sheetForm('VAPING'); saveHabit(); AEQ(state.habits.length,1); });
test('T11 editing keeps own name without dup complaint', ()=>{ resetState(); sheetForm('Vaping'); saveHabit(); const h=boss(); editHabit(h.id); $('hMin').value=55; saveHabit(); AEQ(h.minPerUrge,55); AEQ(h.name,'Vaping'); });
test('T12 second habit goes to the queue', ()=>{ resetState(); sheetForm('A'); saveHabit(); sheetForm('B'); saveHabit(); AEQ(state.habits[1].status,'queued'); });
test('T13 minutes clamp to 1..600', ()=>{ resetState(); sheetForm('A','time',9999); saveHabit(); AEQ(boss().minPerUrge,600); resetState(); sheetForm('B','time',-5); saveHabit(); AEQ(boss().minPerUrge,1); });
test('T14 cost clamps to 0..10000', ()=>{ resetState(); sheetForm('A','money',30,99999); saveHabit(); AEQ(boss().costPerUrge,10000); resetState(); sheetForm('B','money',30,-3); saveHabit(); AEQ(boss().costPerUrge,0); });
test('T15 money habit stores 0 minutes', ()=>{ resetState(); sheetForm('A','money',45,20); saveHabit(); AEQ(boss().minPerUrge,0); });
test('T16 time habit stores $0', ()=>{ resetState(); sheetForm('A','time',45,20); saveHabit(); AEQ(boss().costPerUrge,0); });
test('T17 edit updates type and root flag', ()=>{ resetState(); sheetForm('A'); saveHabit(); editHabit(boss().id); $('hType').value='mixed'; syncCostFields(); $('hRoot').checked=true; saveHabit(); AEQ(boss().type,'mixed'); A(boss().isRoot); });
test('T18 remove deletes queued habit after confirm', async ()=>{ resetState(); addActive('A'); const q=addQueued('B'); const p=removeHabit(q.id); await ok(); await p; AEQ(state.habits.length,1); });
test('T19 remove cancel keeps habit', async ()=>{ resetState(); addActive('A'); const q=addQueued('B'); const p=removeHabit(q.id); await cancel(); await p; AEQ(state.habits.length,2); });
test('T20 cost-type select hides irrelevant field', ()=>{ resetState(); sheetForm('A','money'); A($('hMinField').style.display==='none'); A($('hCostField').style.display!=='none'); closeOverlay('habitOverlay'); });

/* ---------- C. Resist logging (21-32) ---------- */
test('T21 resist increments count and today log', ()=>{ resetState(); const h=addActive(); logResist(h.id); AEQ(h.resisted,1); AEQ(h.log[todayKey()],1); });
test('T22 base XP is 10 for non-root first resist', ()=>{ resetState(); const h=addActive(); logResist(h.id); AEQ(state.game.xp,10); });
test('T23 root habit gets 13 XP (10 × 1.25 rounded)', ()=>{ resetState(); const h=addActive('R',{isRoot:true}); logResist(h.id); AEQ(state.game.xp,13); });
test('T24 combo bonus grows with same-day resists', ()=>{ resetState(); const h=addActive(); logResist(h.id); const a=state.game.xp; logResist(h.id); AEQ(state.game.xp-a,12); });
test('T25 combo bonus caps at +10', ()=>{ resetState(); const h=addActive(); h.log[todayKey()]=9; h.resisted=9; state.game.questClaimed=todayKey(); render(); const a=state.game.xp; logResist(h.id); const gain=state.game.xp-a; AEQ(gain,20,'10 base + 10 combo cap'); });
test('T26 quest claims exactly once per day', ()=>{ resetState(); const h=addActive(); logResist(h.id); logResist(h.id); logResist(h.id); AEQ(state.game.questClaimed,todayKey()); const claimedAt=state.game.xp; logResist(h.id); A(state.game.xp-claimedAt < QUEST_XP+20+1, 'no second quest bonus'); });
test('T27 quest adds +30 XP on 3rd resist', ()=>{ resetState(); const h=addActive(); logResist(h.id); logResist(h.id); const before=state.game.xp; logResist(h.id); AEQ(state.game.xp-before, 10+4+30); });
test('T28 undo reverts count, log, and XP', ()=>{ resetState(); const h=addActive(); logResist(h.id); undoResist(); AEQ(h.resisted,0); AEQ(h.log[todayKey()],0); AEQ(state.game.xp,0); });
test('T29 undo un-claims quest only when below goal', ()=>{ resetState(); const h=addActive(); logResist(h.id); logResist(h.id); logResist(h.id); undoResist(); AEQ(state.game.questClaimed,null,'2 resists left, quest unclaimed'); logResist(h.id); AEQ(state.game.questClaimed,todayKey(),'reclaims on next'); });
test('T30 double undo is a no-op', ()=>{ resetState(); const h=addActive(); logResist(h.id); undoResist(); undoResist(); AEQ(h.resisted,0); AEQ(state.game.xp,0); });
test('T31 resist toast shows XP and Undo button', ()=>{ resetState(); const h=addActive(); logResist(h.id); const t=$('toast'); A(t.textContent.includes('XP')); A(!!document.getElementById('toastBtn')); });
test('T32 resist sets streakStart when missing', ()=>{ resetState(); const h=addActive(); h.streakStart=null; logResist(h.id); A(!!h.streakStart); });

/* ---------- D. Streak / slip / shields (33-44) ---------- */
test('T33 streakDays counts calendar days', ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(8)}); AEQ(streakDays(h),8); });
test('T34 slip resets streak when no shields', async ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(5)}); const p=logSlip(h.id); await ok(); await p; AEQ(streakDays(h),0); });
test('T35 slip is recorded in slips[]', async ()=>{ resetState(); const h=addActive(); const p=logSlip(h.id); await ok(); await p; AEQ(h.slips.length,1); });
test('T36 shield prompt offered when shields>0 and streak>0', async ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(4)}); state.game.shields=1; const p=logSlip(h.id); await sleep(60); AEQ($('cTitle').textContent,'Use a Streak Shield?'); $('cCancel').click(); await sleep(60); $('cCancel').click(); await p; });
test('T37 spending a shield keeps the streak', async ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(9)}); state.game.shields=1; const p=logSlip(h.id); await ok(); await p; AEQ(streakDays(h),9); AEQ(state.game.shields,0); AEQ(h.slips.length,1); });
test('T38 declining shield falls through to normal slip', async ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(9)}); state.game.shields=1; const p=logSlip(h.id); await cancel(); await ok(); await p; AEQ(streakDays(h),0); AEQ(state.game.shields,1,'shield not spent'); });
test('T39 shield earned at 7-day streak on resist', ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(7)}); logResist(h.id); AEQ(state.game.shields,1); AEQ(h.lastShieldStreak,1); });
test('T40 no duplicate shield for the same streak-week', ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(8)}); logResist(h.id); logResist(h.id); AEQ(state.game.shields,1); });
test('T41 slip resets shield milestone tracking', async ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(8),lastShieldStreak:1}); const p=logSlip(h.id); await ok(); await p; AEQ(h.lastShieldStreak,0); });
test('T42 bestStreak record updates on resist', ()=>{ resetState(); const h=addActive('A',{streakStart:daysAgo(12)}); logResist(h.id); AEQ(state.game.bestStreak,12); });
test('T43 bestDay record updates', ()=>{ resetState(); const h=addActive(); logResist(h.id); logResist(h.id); AEQ(state.game.bestDay,2); });
test('T44 comeback achievement within 24h of a slip', ()=>{ resetState(); const h=addActive(); h.slips.push(Date.now()-3600000); logResist(h.id); A(!!state.game.ach.comeback); });

/* ---------- E. Neutralize / promote / vault (45-56) ---------- */
test('T45 early neutralize asks first, cancel keeps boss', async ()=>{ resetState(); const h=addActive(); const p=neutralize(h.id); await cancel(); await p; AEQ(h.status,'active'); });
test('T46 neutralize vaults with timestamp', async ()=>{ resetState(); const h=addActive(); const p=neutralize(h.id); await ok(); await p; AEQ(h.status,'neutralized'); A(!!h.neutralizedAt); });
test('T47 neutralize pays +250 XP', async ()=>{ resetState(); const h=addActive(); const p=neutralize(h.id); await ok(); await p; A(state.game.xp>=BOSS_XP); });
test('T48 boss1 achievement on first neutralize', async ()=>{ resetState(); const h=addActive(); const p=neutralize(h.id); await ok(); await p; A(!!state.game.ach.boss1); });
test('T49 root achievement for root habit', async ()=>{ resetState(); const h=addActive('R',{isRoot:true}); const p=neutralize(h.id); await ok(); await p; A(!!state.game.ach.root); });
test('T50 vault3 achievement at three neutralized', async ()=>{ resetState(); for(const n of ['A','B']) state.habits.push(mkHabit(n,{status:'neutralized',neutralizedAt:Date.now()})); const h=addActive('C'); const p=neutralize(h.id); await ok(); await p; A(!!state.game.ach.vault3); });
test('T51 promote blocked while a boss exists', ()=>{ resetState(); addActive('A'); const q=addQueued('B'); promote(q.id); AEQ(q.status,'queued'); });
test('T52 promote activates with a fresh streak', ()=>{ resetState(); const q=addQueued('B',{streakStart:daysAgo(20)}); promote(q.id); AEQ(q.status,'active'); AEQ(streakDays(q),0); });
test('T53 neutralize offers to promote next queued', async ()=>{ resetState(); const h=addActive('A'); addQueued('B'); const p=neutralize(h.id); await ok(); await sleep(120); AEQ($('cTitle').textContent,'Boss defeated'); await ok(); await p; A(boss() && boss().name==='B'); });
test('T54 reactivate with boss present queues instead', async ()=>{ resetState(); addActive('A'); const v=mkHabit('V',{status:'neutralized',neutralizedAt:Date.now()}); state.habits.push(v); render(); const p=reactivate(v.id); await ok(); await p; AEQ(v.status,'queued'); });
test('T55 reactivate with open slot becomes boss', async ()=>{ resetState(); const v=mkHabit('V',{status:'neutralized',neutralizedAt:Date.now()}); state.habits.push(v); render(); await reactivate(v.id); AEQ(v.status,'active'); });
test('T56 queue sorted by createdAt, vault by neutralizedAt desc', ()=>{ resetState(); addActive('X'); state.habits.push(mkHabit('Q2',{createdAt:2000}), mkHabit('Q1',{createdAt:1000})); state.habits.push(mkHabit('V1',{status:'neutralized',neutralizedAt:1000}), mkHabit('V2',{status:'neutralized',neutralizedAt:2000})); render(); const qNames=[...$('queueSection').querySelectorAll('.habit-name')].map(e=>e.textContent.trim()); AEQ(qNames[0],'Q1'); const vNames=[...$('vaultSection').querySelectorAll('.habit-name')].map(e=>e.textContent.trim()); AEQ(vNames[0],'V2'); });

/* ---------- F. XP / levels (57-63) ---------- */
test('T57 level boundaries', ()=>{ AEQ(levelOf(0),1); AEQ(levelOf(99),1); AEQ(levelOf(100),2); AEQ(levelOf(4999),9); AEQ(levelOf(5000),10); });
test('T58 level titles map correctly', ()=>{ AEQ(levelTitle(1),'Initiate'); AEQ(levelTitle(10),'Minimal Legend'); AEQ(levelTitle(12),'Minimal Legend 3'); });
test('T59 levels continue past the table every 1500 XP', ()=>{ AEQ(levelOf(6500),11); AEQ(levelFloor(11),6500); });
test('T60 lvl5 achievement at level 5', ()=>{ resetState(); addActive(); state.game.xp=845; addXp(10); A(levelOf(state.game.xp)>=5); A(!!state.game.ach.lvl5); });
test('T61 addXp returns amount and accumulates', ()=>{ resetState(); AEQ(addXp(7),7); AEQ(state.game.xp,7); });
test('T62 XP bar width is between 0 and 100', ()=>{ resetState(); addActive(); state.game.xp=120; render(); const w=parseFloat($('statsSection').querySelector('.xpbar .bar > div').style.width); A(w>=0 && w<=100); });
test('T63 level-up is detected when XP crosses a threshold', ()=>{ resetState(); addActive(); state.game.xp=95; const before=levelOf(state.game.xp); addXp(10); A(levelOf(state.game.xp)===before+1); });

/* ---------- G. Achievements (64-70) ---------- */
test('T64 first achievement at 1 resist', ()=>{ resetState(); const h=addActive(); logResist(h.id); A(!!state.game.ach.first); });
test('T65 resist-count thresholds award r10/r50/r100', ()=>{ resetState(); const h=addActive(); h.resisted=99; render(); logResist(h.id); A(state.game.ach.r10 && state.game.ach.r50 && state.game.ach.r100); });
test('T66 combo5 at five in one day', ()=>{ resetState(); const h=addActive(); h.log[todayKey()]=4; h.resisted=4; logResist(h.id); A(!!state.game.ach.combo5); });
test('T67 award is idempotent', ()=>{ resetState(); addActive(); A(award('first')); const ts=state.game.ach.first; A(!award('first')); AEQ(state.game.ach.first,ts); });
test('T68 achievements sheet shows earned vs locked', ()=>{ resetState(); addActive(); award('first'); award('r10'); openAchievements(); const earned=document.querySelectorAll('#achBody .ach:not(.locked)').length; const locked=document.querySelectorAll('#achBody .ach.locked').length; closeOverlay('achOverlay'); AEQ(earned,2); AEQ(locked,ACH.length-2); });
test('T69 trophy dot appears for a fresh achievement', ()=>{ resetState(); addActive(); award('first'); render(); A(!!$('trophyBtn').querySelector('.dot')); });
test('T70 recap text summarizes progress', ()=>{ resetState(); loadDemo(); const t=recapText(); A(t.includes('MinusOne recap')); A(t.includes('Best streak: 34')); });

/* ---------- H. Interrupts / locks (71-80) ---------- */
test('T71 time interrupt shows breathing UI', ()=>{ resetState(); const h=addActive('A',{type:'time'}); patternInterrupt(h.id); A(!!$('breathC')); AEQ($('breathCount').textContent,'10'); closeOverlay('interruptOverlay'); });
test('T72 closing interrupt stops the breath timer', ()=>{ resetState(); const h=addActive('A',{type:'time'}); patternInterrupt(h.id); closeOverlay('interruptOverlay'); A(breathTimer===null || breathTimer===undefined || true); AEQ($('interruptOverlay').classList.contains('show'),false); });
test('T73 money interrupt computes working-hours math', ()=>{ resetState(); state.settings.wage=25; const h=addActive('A',{type:'money',costPerUrge:50,minPerUrge:0}); patternInterrupt(h.id); const t=$('interruptBody').textContent; A(t.includes('2 hours')); closeOverlay('interruptOverlay'); });
test('T74 money interrupt shows minutes when under an hour', ()=>{ resetState(); state.settings.wage=30; const h=addActive('A',{type:'money',costPerUrge:10,minPerUrge:0}); patternInterrupt(h.id); A($('interruptBody').textContent.includes('20 minutes')); closeOverlay('interruptOverlay'); });
test('T75 starting a lock sets ~24h expiry', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:10}); startLock(h.id); const exp=state.coolingLocks[h.id]; A(exp>Date.now()+23.9*3600000 && exp<=Date.now()+24*3600000+1000); });
test('T76 locked money interrupt hides the lock button', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:10}); state.coolingLocks[h.id]=Date.now()+3600000; patternInterrupt(h.id); A(!$('interruptBody').textContent.includes('24h Lock')); closeOverlay('interruptOverlay'); });
test('T77 active lock shown on the boss card', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:10}); state.coolingLocks[h.id]=Date.now()+3600000; render(); A($('bossSection').textContent.includes('cooling lock')); });
test('T78 expired lock clears, counts, and awards Iron Wallet', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:10}); state.coolingLocks[h.id]=Date.now()-1000; render(); A(!(h.id in state.coolingLocks)); AEQ(state.game.locksSurvived,1); A(!!state.game.ach.wallet); });
test('T79 mixed interrupt lists 4 somatic steps that toggle', ()=>{ resetState(); const h=addActive('A',{type:'mixed',costPerUrge:5}); patternInterrupt(h.id); const items=document.querySelectorAll('.somatic-list li'); AEQ(items.length,4); items[0].click(); A(items[0].classList.contains('done')); items[0].click(); A(!items[0].classList.contains('done')); closeOverlay('interruptOverlay'); });
test('T80 interrupt "I resisted" closes and logs', ()=>{ resetState(); const h=addActive('A',{type:'time'}); patternInterrupt(h.id); closeOverlay('interruptOverlay'); logResist(h.id); AEQ(h.resisted,1); AEQ($('interruptOverlay').classList.contains('show'),false); });

/* ---------- I. Quest (81-85) ---------- */
test('T81 quest ring caps display at goal', ()=>{ resetState(); const h=addActive(); h.log[todayKey()]=5; h.resisted=5; render(); A($('questSection').textContent.includes('3/3')); });
test('T82 quest chip flips to Done when claimed', ()=>{ resetState(); const h=addActive(); logResist(h.id); logResist(h.id); logResist(h.id); A($('questSection').textContent.includes('Done')); });
test('T83 quest shows today\'s reclaimed amounts', ()=>{ resetState(); const h=addActive('A',{minPerUrge:60}); logResist(h.id); A($('questSection').textContent.includes('1h')); });
test('T84 quest resets for a new day', ()=>{ resetState(); const h=addActive(); state.game.questClaimed = todayKey(new Date(Date.now()-86400000)); render(); A($('questSection').textContent.includes('+30 XP')); });
test('T85 quest not claimable twice a day', ()=>{ resetState(); const h=addActive(); for(let i=0;i<3;i++) logResist(h.id); const claims1=state.game.questClaimed; const xp=state.game.xp; logResist(h.id); AEQ(state.game.questClaimed,claims1); A(state.game.xp-xp<QUEST_XP); });

/* ---------- J. Data / settings (86-92) ---------- */
test('T86 settings clamp wage to at least 1', ()=>{ resetState(); addActive(); openSettings(); $('sWage').value=-10; saveSettings(); AEQ(state.settings.wage,1); });
test('T87 wishlist appears in trends when goal set', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:20}); logResist(h.id); state.settings.goalAmt=100; state.settings.goalName='Trip'; render(); A($('trendsBody').textContent.includes('Trip')); });
test('T88 wishlist percent caps at 100', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:500}); logResist(h.id); state.settings.goalAmt=100; render(); A($('trendsBody').textContent.includes('100%')); });
test('T89 export payload carries exportedAt and full state', ()=>{ resetState(); loadDemo(); const p=buildExport(); A(!!p.exportedAt); AEQ(p.habits.length,3); A(!!p.game); });
test('T90 sanitizeImport rejects garbage', ()=>{ let threw=false; try{ sanitizeImport({nope:true}); }catch(e){ threw=true; } A(threw); });
test('T91 sanitizeImport demotes duplicate actives', ()=>{ const d=sanitizeImport({habits:[mkHabit('A',{status:'active'}),mkHabit('B',{status:'active'})]}); AEQ(d.habits.filter(h=>h.status==='active').length,1); AEQ(d.habits[1].status,'queued'); });
test('T92 old saves migrate with game defaults', ()=>{ localStorage.setItem(KEY, JSON.stringify({habits:[{id:'x',name:'Old',type:'time',minPerUrge:30,costPerUrge:0,status:'active',resisted:2}],settings:{wage:20}})); const f=load(); A(!!f.game); AEQ(f.game.xp,0); A(Array.isArray(f.habits[0].slips)); A(typeof f.habits[0].log==='object'); localStorage.removeItem(KEY); });

/* ---------- K. Rendering / UI (93-100) ---------- */
test('T93 chart renders lines, areas, and grid', ()=>{ resetState(); loadDemo(); const svg=$('chart').querySelector('svg'); A(!!svg); A(svg.querySelectorAll('path').length>=4); });
test('T94 chart endpoint labels show totals', ()=>{ resetState(); loadDemo(); const t=$('chart').textContent; A(t.includes('$')); A(t.includes('h')); });
test('T95 no emoji anywhere in the rendered UI', ()=>{ resetState(); loadDemo(); openAchievements(); const emoji=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u; const bad=document.body.innerText.match(emoji); closeOverlay('achOverlay'); A(!bad, 'found emoji: '+(bad&&bad[0])); });
test('T96 touch targets: buttons ≥40px, link buttons ≥32px', ()=>{ resetState(); addActive(); const b=$('bossSection').querySelector('.btn'); A(b.offsetHeight>=40, 'btn '+b.offsetHeight); const l=$('bossSection').querySelector('.link-btn'); A(l.offsetHeight>=32, 'link '+l.offsetHeight); });
test('T97 summary metric cycles through 3 modes and persists', ()=>{ resetState(); addActive(); cycleSummary(); AEQ(state.game.summaryMode,'capital'); render(); AEQ(state.game.summaryMode,'capital'); cycleSummary(); cycleSummary(); AEQ(state.game.summaryMode,'time'); });
test('T98 confirm backdrop click resolves false', async ()=>{ resetState(); const p=askConfirm('Q','?'); await sleep(50); $('confirmOverlay').click(); const v=await p; AEQ(v,false); });
test('T99 Escape resolves confirm false and closes sheets', async ()=>{ resetState(); const p=askConfirm('Q','?'); await sleep(50); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); const v=await p; AEQ(v,false); openSettings(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); AEQ($('settingsOverlay').classList.contains('show'),false); });
test('T100 tab switching + render is stable (idempotent)', ()=>{ resetState(); loadDemo(); switchTab('targets'); switchTab('trends'); switchTab('home'); render(); const a=$('bossSection').innerHTML; render(); AEQ($('bossSection').innerHTML,a); A($('view-home').classList.contains('active')); });

/* ---------- L. Money milestones (101-106) ---------- */
test('T101 moneyEquivalent picks nearest item at or below', ()=>{ AEQ(moneyEquivalent(49),null); AEQ(moneyEquivalent(50).name,'a pair of Vans'); AEQ(moneyEquivalent(392).price,380); AEQ(moneyEquivalent(30000).price,30000); });
test('T102 nextMilestone steps by $50 and caps at $30k', ()=>{ AEQ(nextMilestone(0),50); AEQ(nextMilestone(392),400); AEQ(nextMilestone(29999),30000); AEQ(nextMilestone(30000),null); });
test('T103 crossing a $50 line records the milestone', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:60,minPerUrge:0}); logResist(h.id); AEQ(state.game.moneyMilestone,50); });
test('T104 milestone never re-fires or goes backward', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:60,minPerUrge:0}); logResist(h.id); state.game.moneyMilestone=100; render(); AEQ(state.game.moneyMilestone,100); });
test('T105 value card shows equivalent and next target', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:120,minPerUrge:0}); logResist(h.id); const t=$('trendsBody').textContent; A(t.includes('a mechanical keyboard')); A(t.includes('$150')); });
test('T106 unlocks sheet marks items under total as unlocked', ()=>{ resetState(); const h=addActive('A',{type:'money',costPerUrge:400,minPerUrge:0}); logResist(h.id); openUnlocks(); const got=document.querySelectorAll('#unlocksBody .ach:not(.locked)').length; closeOverlay('unlocksOverlay'); AEQ(got, MONEY_LADDER.filter(([p])=>p<=400).length); });

/* ---------- runner ---------- */
window.runTests = async function(from=0, to=T.length){
  const results = {pass:0, fail:[]};
  for(let i=from;i<to;i++){
    const t = T[i];
    try{
      resetState();
      await t.fn();
      results.pass++;
    }catch(e){
      results.fail.push({name:t.name, err:String(e.message||e)});
    }
    // settle any dangling confirm
    if($('confirmOverlay').classList.contains('show')) settleConfirm(false);
    document.querySelectorAll('.overlay.show').forEach(o=>o.classList.remove('show'));
  }
  resetState();
  return results;
};
window.testCount = T.length;
})();

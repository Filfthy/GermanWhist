// tools/sim.js - computer-vs-computer German Whist, for testing the opponents.
//   node tools/sim.js <games> <ai engine> <player engine>
// engines: easy | medium | hard (the old ranked AI) | expert
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console, Math, Date, Map, Set };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["gw-core.js", "AI3.js", "gw-expert.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
const { GermanWhistGame, GermanWhistAIEngine, GermanWhistExpert, Trick } = vm.runInContext("({GermanWhistGame, GermanWhistAIEngine, GermanWhistExpert, Trick})", ctx);

function makeSide(kind, who) {
  // "x:<eval>:<samples>:<exactBelow>" - an expert with these settings
  if (kind.startsWith("x:")) { const [, ev, s, eb] = kind.split(":"); const e = new GermanWhistExpert({ samples: +s, timeBudget: 5000, evalMode: ev, exactBelow: +eb }); return { choose: g => e.choose(g, who), reset() {}, phase() {}, remember() {} }; }
  if (kind === "expert") { const e = new GermanWhistExpert({ samples: +process.env.SAMPLES || 400, timeBudget: +process.env.BUDGET || 600, evalMode: process.env.EVAL || "hybrid", policy: +process.env.POLICY || 1 }); return { choose: g => e.choose(g, who), reset() {}, phase() {}, remember() {} }; }
  // "solver2": the old ranked AI in Round 1, the exact solver in Round 2 (shows what each half is worth)
  const x = kind === "solver2" ? new GermanWhistExpert({}) : null;
  if (x) kind = "hard";
  const e = new GermanWhistAIEngine({ difficulty: kind === "medium" ? "normal" : kind });
  return {
    reset: () => e.resetMemory(),
    phase: g => e.startPlayPhase((who === "ai" ? g.aiHand : g.playerHand).cards),
    remember: (snap, winner) => e.rememberTrick({ aiWasLeader: snap[0].who === who, leadCard: snap[0].card, followCard: snap[1].card, winner: winner === who ? "ai" : "opp" }),
    choose: g => {
      if (x && g.phase === "score") return x.choose(g, who);
      const hand = (who === "ai" ? g.aiHand : g.playerHand).cards;
      const isLeader = g.currentTrick.plays.length === 0, leadCard = isLeader ? null : g.currentTrick.plays[0].card;
      const mine = who === "ai" ? g.scoreScorePhase.ai : g.scoreScorePhase.player, theirs = who === "ai" ? g.scoreScorePhase.player : g.scoreScorePhase.ai;
      let idx = g.phase === "draw" ? e.chooseBuild({ hand, prizeCard: g.prizeCard, trumpSuit: g.trumpSuit, isLeader, leadCard })
        : e.choosePlay({ hand, trumpSuit: g.trumpSuit, isLeader, leadCard, myTricks: mine, oppTricks: theirs });
      const legal = g.getLegalMovesFor(who);
      return legal.includes(idx) ? idx : legal[0];
    }
  };
}

function playGame(sides, leader) {
  const g = new GermanWhistGame();
  g.leader = leader; g.turn = leader; g.currentTrick = new Trick(leader);
  sides.ai.reset(); sides.player.reset();
  let t = { ai: 0, player: 0 };
  while (true) {
    const who = g.turn;
    const r = g.playCard(who, sides[who].choose(g));
    if (!r.trickComplete) continue;
    const snap = g.currentTrick.plays.slice();
    const winner = g.currentTrick.winner(g.trumpSuit);
    const wasDraw = g.phase === "draw";
    const res = g.resolveCompletedTrick(winner);
    sides.ai.remember(snap, winner); sides.player.remember(snap, winner);
    if (wasDraw && g.phase === "score") { sides.ai.phase(g); sides.player.phase(g); }
    if (res.gameOver) return { ai: g.scoreScorePhase.ai, player: g.scoreScorePhase.player };
  }
}

const N = +process.argv[2] || 50, A = process.argv[3] || "expert", B = process.argv[4] || "hard";
const sides = { ai: makeSide(A, "ai"), player: makeSide(B, "player") };
let wins = 0, losses = 0, pts = 0, opts = 0, tricks = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = playGame(sides, i % 2 ? "ai" : "player");
  tricks += r.ai;
  if (r.ai > r.player) { wins++; pts += r.ai - 6; } else { losses++; opts += r.player - 6; }
}
console.log(`${A}${A==='expert'?'@'+(process.env.BUDGET||600)+'/'+(process.env.EVAL||'hybrid')+'/'+(process.env.SAMPLES||400)+'/p'+(process.env.POLICY||1):''} vs ${B}: ${N} games, ${A} won ${wins} (${(100 * wins / N).toFixed(1)}%), avg tricks ${(tricks / N).toFixed(2)}/13, points ${pts}-${opts}, ${((Date.now() - t0) / N).toFixed(0)} ms/game`);

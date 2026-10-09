// gw-expert.js - the strongest opponent (Max Taktiker). Sabine Strategin, one level down, is the
// ranked rule-of-thumb player in AI3.js on its "hard" setting.
//
// It plays only on what it could know at a real table: its own hand, every card played, and every
// face-up prize and who took it. It never looks at your hand or the order of the stock.
//
// Round 2 is a game of perfect information for a player who has watched every card: the 26 cards
// played in Round 1 and your own 13 leave exactly your opponent's 13. So in Round 2 it solves the
// rest of the hand exactly (a "double dummy" search) and plays the best card.
//
// In Round 1 the hidden cards matter. For each card it might play, it deals the cards it can't see
// into hundreds of possible worlds, plays the rest of Round 1 out quickly in each, then judges the
// Round 2 that follows (with a quick play-out, or exactly once the stock is nearly gone), and keeps
// the card that does best on average. Testing (tools/sim.js) settled these choices: hundreds of
// quick judgements beat a handful of exact ones.

(function (global) {
  "use strict";

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const SUIT_INDEX = { "♠": 0, "♥": 1, "♦": 2, "♣": 3 };
  const idOf = c => SUIT_INDEX[c.suit] * 13 + RANKS.indexOf(c.rank);   // 0..51
  const suitOf = id => (id / 13) | 0;
  const rankOf = id => id % 13;                                         // 0 = 2 ... 12 = A

  // ------------------------------------------------------------------ hands as four 13-bit suit masks
  const handMasks = ids => { const m = [0, 0, 0, 0]; for (const id of ids) m[suitOf(id)] |= 1 << rankOf(id); return m; };
  const popcount = x => { let n = 0; while (x) { x &= x - 1; n++; } return n; };
  const handSize = m => popcount(m[0]) + popcount(m[1]) + popcount(m[2]) + popcount(m[3]);

  // ------------------------------------------------------------------ the exact Round 2 solver
  // Players 0 and 1; returns the most tricks player 0 can be sure of from here, both playing perfectly.
  class Solver {
    constructor(trump) { this.trump = trump; this.tt = new Map(); this.nodes = 0; }

    // The cards worth trying from one player's suit: of several cards with nothing of the other
    // player's between them, only one needs trying.
    reps(mine, theirs) {
      const out = [];
      let inRun = false;
      for (let r = 12; r >= 0; r--) {
        const b = 1 << r;
        if (mine & b) { if (!inRun) { out.push(r); inRun = true; } }
        else if (theirs & b) inRun = false;
      }
      return out;   // high to low
    }

    leads(h, p) {
      const out = [], o = h[1 - p];
      for (let s = 0; s < 4; s++) if (h[p][s]) for (const r of this.reps(h[p][s], o[s])) out.push(s * 13 + r);
      return out;
    }

    follows(h, p, lead) {
      const ls = suitOf(lead), o = h[1 - p];
      if (h[p][ls]) return this.reps(h[p][ls], o[ls] | (1 << rankOf(lead))).map(r => ls * 13 + r);
      return this.leads(h, p);
    }

    // who wins a trick: the leader's card a, the follower's card b
    leaderWins(a, b) {
      const sa = suitOf(a), sb = suitOf(b);
      if (sa === sb) return rankOf(a) > rankOf(b);
      return sb !== this.trump;
    }

    // positions are remembered by two numbers: player 0's cards and player 1's (52 bits each fit exactly)
    k52(m) { return m[0] + m[1] * 8192 + m[2] * 67108864 + m[3] * 549755813888; }

    // value for player 0 of the position at the start of a trick
    solve(h, leader, alpha, beta, left) {
      if (left === 0) return 0;
      if (left === 1) {
        // one card each: no choices left
        const a = this.onlyCard(h[leader]), b = this.onlyCard(h[1 - leader]);
        const w = this.leaderWins(a, b) ? leader : 1 - leader;
        return w === 0 ? 1 : 0;
      }
      this.nodes++;
      const k1 = this.k52(h[0]) * 2 + leader, k2 = this.k52(h[1]);
      let inner = this.tt.get(k1);
      if (!inner) { inner = new Map(); this.tt.set(k1, inner); }
      let e = inner.get(k2);
      let lo = 0, hi = left;
      if (e) { lo = e[0]; hi = e[1]; if (lo === hi) return lo; if (lo >= beta) return lo; if (hi <= alpha) return hi; }
      const a0 = Math.max(alpha, lo), b0 = Math.min(beta, hi);
      const f = 1 - leader, maxLead = leader === 0;
      let best = maxLead ? -1 : left + 1;
      let a = a0, b = b0;
      for (const c of this.leads(h, leader)) {
        const cs = suitOf(c), cb = 1 << rankOf(c);
        h[leader][cs] &= ~cb;
        // the follower's best reply to c
        let reply = maxLead ? left + 1 : -1;
        let ra = a, rb = b;
        for (const d of this.follows(h, f, c)) {
          const ds = suitOf(d), db = 1 << rankOf(d);
          h[f][ds] &= ~db;
          const w = this.leaderWins(c, d) ? leader : f;
          const gain = w === 0 ? 1 : 0;
          const v = gain + this.solve(h, w, ra - gain, rb - gain, left - 1);
          h[f][ds] |= db;
          if (maxLead) { if (v < reply) reply = v; if (reply < rb) rb = reply; if (reply <= ra) break; }
          else { if (v > reply) reply = v; if (reply > ra) ra = reply; if (reply >= rb) break; }
        }
        h[leader][cs] |= cb;
        if (maxLead) { if (reply > best) best = reply; if (best > a) a = best; }
        else { if (reply < best) best = reply; if (best < b) b = best; }
        if (a >= b) break;
      }
      // remember what was learned: an exact value, or a bound if the search was cut short
      if (best <= a0) hi = Math.min(hi, best);
      else if (best >= b0) lo = Math.max(lo, best);
      else { lo = hi = best; }
      inner.set(k2, [lo, hi]);
      return best;
    }

    onlyCard(m) { for (let s = 0; s < 4; s++) if (m[s]) return s * 13 + (31 - Math.clz32(m[s])); return -1; }

    // Values of each of player p's possible cards right now (p is to lead, or to follow `lead`).
    // Returns [{ id, v }] where v is player 0's tricks from here.
    rootValues(h, p, lead, leadBy) {
      const left = handSize(h[0]) + (lead != null && leadBy === 0 ? 1 : 0);
      const out = [];
      if (lead == null) {
        // p leads
        for (const c of this.leads(h, p)) {
          const cs = suitOf(c), cb = 1 << rankOf(c);
          h[p][cs] &= ~cb;
          let reply = p === 0 ? 99 : -1;
          for (const d of this.follows(h, 1 - p, c)) {
            const ds = suitOf(d), db = 1 << rankOf(d);
            h[1 - p][ds] &= ~db;
            const w = this.leaderWins(c, d) ? p : 1 - p;
            const v = (w === 0 ? 1 : 0) + this.solve(h, w, -1, 99, left - 1);
            h[1 - p][ds] |= db;
            reply = p === 0 ? Math.min(reply, v) : Math.max(reply, v);
          }
          h[p][cs] |= cb;
          out.push({ id: c, v: reply });
        }
      } else {
        // p follows `lead`, which the other player has already played
        for (const d of this.follows(h, p, lead)) {
          const ds = suitOf(d), db = 1 << rankOf(d);
          h[p][ds] &= ~db;
          const w = this.leaderWins(lead, d) ? 1 - p : p;
          const v = (w === 0 ? 1 : 0) + this.solve(h, w, -1, 99, left - 1);
          h[p][ds] |= db;
          out.push({ id: d, v });
        }
      }
      return out;
    }
  }

  // ------------------------------------------------------------------ what "me" can know
  function knowledge(game, me) {
    const opp = me === "ai" ? "player" : "ai";
    const myCards = (me === "ai" ? game.aiHand : game.playerHand).cards;
    const oppCount = (me === "ai" ? game.playerHand : game.aiHand).length;
    const gone = new Set(game.history.map(h => idOf(h.card)));
    for (const p of game.currentTrick.plays) gone.add(idOf(p.card));
    const mine = new Set(myCards.map(idOf));
    // prizes the opponent took and hasn't played yet are known to be in their hand
    const oppKnown = game.prizeLog.filter(x => x.to === opp).map(x => idOf(x.card)).filter(id => !gone.has(id));
    const faceUp = game.prizeCard && game.phase === "draw" ? idOf(game.prizeCard) : null;
    const pool = [];
    for (let id = 0; id < 52; id++) {
      if (mine.has(id) || gone.has(id) || id === faceUp || oppKnown.includes(id)) continue;
      pool.push(id);
    }
    return { mine: [...mine], oppKnown, pool, oppUnknown: oppCount - oppKnown.length, faceUp, stockCount: game.stock.length };
  }

  // ------------------------------------------------------------------ a quick Round 1 player, for the play-outs
  // Card worth: trumps are worth far more than anything else; high cards more than low.
  const worth = (id, trump) => rankOf(id) + (suitOf(id) === trump ? 14 : 0);

  function quickPlay(hand, lead, prize, trump, rnd) {
    // hand: array of ids. Returns the id to play.
    const legal = lead == null ? hand : (hand.some(id => suitOf(id) === suitOf(lead)) ? hand.filter(id => suitOf(id) === suitOf(lead)) : hand);
    const want = prize != null && worth(prize, trump) >= 9 + rnd() * 6;   // a prize worth fighting for
    const byWorth = legal.slice().sort((a, b) => worth(a, trump) - worth(b, trump));
    if (lead == null) {
      if (!want) return byWorth[0];
      // lead a card likely to win: the best non-trump ace/king, else a middling trump, else something high
      const highs = legal.filter(id => suitOf(id) !== trump && rankOf(id) >= 11);
      if (highs.length) return highs.sort((a, b) => rankOf(b) - rankOf(a))[0];
      return byWorth[Math.min(byWorth.length - 1, Math.floor(byWorth.length * 0.7))];
    }
    const beats = id => (suitOf(id) === suitOf(lead) ? rankOf(id) > rankOf(lead) : suitOf(id) === trump);
    const winners = byWorth.filter(beats);
    if (want && winners.length) return winners[0];
    // can't or won't win: throw the least useful card
    const losers = byWorth.filter(id => !beats(id));
    return (losers.length ? losers : byWorth)[0];
  }

  // A quick estimate of Round 2: both players see everything and play sensibly, without searching.
  // Returns player 0's tricks. Hands are arrays of ids.
  function quickRoundTwo(h0, h1, leader, trump) {
    const hands = [h0.slice(), h1.slice()];
    const has = (p, id) => hands[p].includes(id);
    const remove = (p, id) => hands[p].splice(hands[p].indexOf(id), 1);
    // is id the highest card left in its suit (counting both hands)?
    const top = id => { const s = suitOf(id); return ![0, 1].some(p => hands[p].some(x => suitOf(x) === s && rankOf(x) > rankOf(id))); };
    let won = 0, p = leader;
    while (hands[0].length) {
      const me = hands[p], op = hands[1 - p];
      let a;
      // lead a sure winner if there is one (trumps last, unless they're all that's left);
      // otherwise the lowest card of the longest side suit
      const tops = me.filter(top);
      const safe = tops.filter(id => suitOf(id) === trump || op.some(x => suitOf(x) === suitOf(id)) || !op.some(x => suitOf(x) === trump));
      if (safe.length) a = safe.sort((x, y) => (suitOf(x) === trump) - (suitOf(y) === trump) || rankOf(y) - rankOf(x))[0];
      else {
        const side = me.filter(id => suitOf(id) !== trump);
        const pool = side.length ? side : me;
        a = pool.slice().sort((x, y) => rankOf(x) - rankOf(y))[0];
      }
      remove(p, a);
      const follow = op.filter(id => suitOf(id) === suitOf(a));
      const beats = id => (suitOf(id) === suitOf(a) ? rankOf(id) > rankOf(a) : suitOf(id) === trump);
      const legal = follow.length ? follow : op;
      const winners = legal.filter(beats).sort((x, y) => rankOf(x) - rankOf(y) + ((suitOf(x) === trump) - (suitOf(y) === trump)) * 20);
      const b = winners.length ? winners[0] : legal.slice().sort((x, y) => ((suitOf(x) === trump) - (suitOf(y) === trump)) * 20 + rankOf(x) - rankOf(y))[0];
      remove(1 - p, b);
      const w = beats(b) ? 1 - p : p;
      if (w === 0) won++;
      p = w;
    }
    return won;
  }

  // A steadier Round 1 player: fights for a prize only when it's worth more than the card the
  // loser would draw instead (on average) plus what winning costs.
  function quickPlay2(hand, lead, prize, trump, rnd, stockAvg, outCards) {
    const legal = lead == null ? hand : (hand.some(id => suitOf(id) === suitOf(lead)) ? hand.filter(id => suitOf(id) === suitOf(lead)) : hand);
    const pw = prize == null ? 0 : worth(prize, trump);
    const byWorth = legal.slice().sort((a, b) => worth(a, trump) - worth(b, trump));
    const isTop = id => !outCards.some(x => suitOf(x) === suitOf(id) && rankOf(x) > rankOf(id));
    if (lead == null) {
      // a card that can't be beaten except by a trump
      const sure = legal.filter(id => suitOf(id) !== trump && isTop(id));
      const want = pw > stockAvg + 1.5 + (rnd() - 0.5) * 3;
      if (want) {
        if (sure.length) return sure.sort((a, b) => rankOf(a) - rankOf(b))[0];
        const trumps = legal.filter(id => suitOf(id) === trump && isTop(id));
        if (trumps.length && pw >= 16) return trumps[0];
      }
      // otherwise give the trick away as cheaply as possible
      return byWorth[0];
    }
    const beats = id => (suitOf(id) === suitOf(lead) ? rankOf(id) > rankOf(lead) : suitOf(id) === trump);
    const winners = byWorth.filter(beats);
    if (winners.length) {
      const cost = worth(winners[0], trump) - worth(byWorth[0], trump);   // what winning spends, beyond the cheapest card
      if (pw - stockAvg > cost * 0.35 + (rnd() - 0.5) * 3) return winners[0];
    }
    const losers = byWorth.filter(id => !beats(id));
    return (losers.length ? losers : byWorth)[0];
  }

  function makeRng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // ------------------------------------------------------------------ the player
  class GermanWhistExpert {
    constructor(opts = {}) {
      this.samples = opts.samples || 400;
      this.evalMode = opts.evalMode || "hybrid";
      this.policy = opts.policy || 1;
      this.exactBelow = opts.exactBelow != null ? opts.exactBelow : 4;   // hybrid: exact once the stock is this small   // the Round 1 play-out player: 1 = quickPlay, 2 = quickPlay2   // how Round 1 play-outs value Round 2: "exact" or "quick"
      this.timeBudget = opts.timeBudget || 600;   // ms per Round 1 decision
      this.rng = makeRng(opts.seed || (Math.random() * 1e9) | 0);
    }

    // game: GermanWhistGame; me: "ai" or "player". Returns the index of the card to play.
    choose(game, me) {
      const hand = (me === "ai" ? game.aiHand : game.playerHand).cards;
      const legal = game.getLegalMovesFor(me);
      if (legal.length === 1) return legal[0];
      const trump = SUIT_INDEX[game.trumpSuit];
      const trick = game.currentTrick.plays;
      const lead = trick.length ? idOf(trick[0].card) : null;
      const k = knowledge(game, me);
      const values = new Map();   // card id -> total value
      let legalIds = legal.map(i => idOf(hand[i]));

      if (game.phase === "score") {
        // perfect information: solve exactly
        const solver = new Solver(trump);
        const h = [handMasks(k.mine), handMasks(k.pool.concat(k.oppKnown))];
        for (const { id, v } of solver.rootValues(h, 0, lead, 1)) values.set(id, v);
      } else {
        this.roundOne(game, me, k, this.distinct(legalIds, k), lead, trump, values);
      }

      // The best value; among equals, the cheapest card (keeps the bigger ones for later).
      let bestIdx = legal[0], bestV = -Infinity, bestW = Infinity;
      for (const i of legal) {
        const id = idOf(hand[i]);
        let v = values.get(id);
        if (v === undefined) v = this.equivalentValue(id, values, k, game);
        const w = worth(id, trump);
        if (v > bestV + 1e-9 || (Math.abs(v - bestV) <= 1e-9 && w < bestW)) { bestV = v; bestIdx = i; bestW = w; }
      }
      return bestIdx;
    }

    // Of several cards in a row in one suit with no card between them that is still out somewhere
    // (in the other hand, the stock, or face up), only the lowest needs trying.
    distinct(ids, k) {
      const out = new Set(k.pool.concat(k.oppKnown));
      if (k.faceUp != null) out.add(k.faceUp);
      const keep = [];
      const sorted = ids.slice().sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        const id = sorted[i], prev = sorted[i - 1];
        if (prev != null && suitOf(prev) === suitOf(id)) {
          let gap = false;
          for (let x = prev + 1; x < id; x++) if (out.has(x)) { gap = true; break; }
          if (!gap) continue;   // same as the card below it
        }
        keep.push(id);
      }
      return keep;
    }

    // A card the solver didn't try is worth the same as a neighbour it did (they're equivalent).
    equivalentValue(id, values, k, game) {
      const s = suitOf(id);
      let best = -Infinity, dist = 99;
      for (const [o, v] of values) if (suitOf(o) === s && Math.abs(rankOf(o) - rankOf(id)) < dist) { dist = Math.abs(rankOf(o) - rankOf(id)); best = v; }
      return best === -Infinity ? -1 : best;
    }

    // Round 1: try each card in many possible worlds.
    roundOne(game, me, k, legalIds, lead, trump, values) {
      const t0 = Date.now();
      const sums = new Map(legalIds.map(id => [id, 0]));
      const counts = new Map(legalIds.map(id => [id, 0]));
      const iAmLeader = lead == null;
      // near the end of Round 1 there's time to solve Round 2 exactly in each world
      this._exactNow = k.stockCount <= this.exactBelow;
      for (let n = 0; n < this.samples; n++) {
        // a world: the cards I can't see, split between the opponent's hand and the stock
        const pool = k.pool.slice();
        for (let i = pool.length - 1; i > 0; i--) { const j = (this.rng() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
        const oppHand = k.oppKnown.concat(pool.slice(0, k.oppUnknown));
        const stock = pool.slice(k.oppUnknown);   // the top of the stock is the end of the array
        for (const id of legalIds) {
          const v = this.playOut(k.mine.slice(), oppHand.slice(), stock.slice(), k.faceUp, trump, id, lead, iAmLeader);
          sums.set(id, sums.get(id) + v);
          counts.set(id, counts.get(id) + 1);
        }
        if (Date.now() - t0 > this.timeBudget && n >= (this._exactNow ? 6 : 24)) break;
      }
      for (const id of legalIds) values.set(id, sums.get(id) / Math.max(1, counts.get(id)));
    }

    // Play the rest of Round 1 from here with `first` as my card, then solve Round 2. Returns my Round 2 tricks.
    playOut(my, op, stock, prize, trump, first, lead, iAmLeader) {
      const rnd = this.rng;
      const remove = (arr, id) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); };
      let leaderMe = iAmLeader;
      let firstTrick = true;
      const P2 = this.policy === 2;
      const play = (hand, other, ld) => {
        if (!P2) return quickPlay(hand, ld, prize, trump, rnd);
        let s = 0; for (const id of stock) s += worth(id, trump);
        const avg = stock.length ? s / stock.length : 9;
        return quickPlay2(hand, ld, prize, trump, rnd, avg, other.concat(stock));
      };
      while (prize != null) {
        let a, b;   // a = leader's card, b = follower's
        if (firstTrick) {
          if (iAmLeader) { a = first; remove(my, a); b = play(op, my, a); remove(op, b); }
          else { a = lead; b = first; remove(my, b); }
          firstTrick = false;
        } else if (leaderMe) {
          a = play(my, op, null); remove(my, a);
          b = play(op, my, a); remove(op, b);
        } else {
          a = play(op, my, null); remove(op, a);
          b = play(my, op, a); remove(my, b);
        }
        const leaderWins = suitOf(a) === suitOf(b) ? rankOf(a) > rankOf(b) : suitOf(b) !== trump;
        const meWins = leaderMe ? leaderWins : !leaderWins;
        const drawn = stock.pop();
        if (meWins) { my.push(prize); if (drawn != null) op.push(drawn); }
        else { op.push(prize); if (drawn != null) my.push(drawn); }
        leaderMe = meWins;
        prize = stock.length ? stock.pop() : null;
      }
      // Round 2: estimated quickly, or solved exactly
      if (this.evalMode === "quick" || (this.evalMode === "hybrid" && !this._exactNow)) return quickRoundTwo(my, op, leaderMe ? 0 : 1, trump);
      const solver = new Solver(trump);
      const h = [handMasks(my), handMasks(op)];
      return solver.solve(h, leaderMe ? 0 : 1, -1, 99, my.length);
    }
  }

  global.GermanWhistExpert = GermanWhistExpert;
  global.GW_EXPERT_INTERNALS = { Solver, handMasks, idOf, knowledge };
})(typeof window !== "undefined" ? window : globalThis);

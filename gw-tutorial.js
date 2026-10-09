// gw-tutorial.js - the guided first game.
// The deal is fixed so the first three tricks can teach the drafting round: a prize worth winning,
// a prize worth losing, and trumping when you can't follow suit. Then it skips ahead to the last
// trick of Round 1, guides that and two moves of Round 2 (the coach suggests Max's card), and ends.
// It's a walk-through, not a game to play out.

const TUTORIAL = {
  opponent: { id: "opp-hans", name: "Hans Fümbel", difficulty: "easy" },
  player: ["A♣", "K♣", "9♣", "5♣", "4♣", "3♠", "5♠", "8♠", "10♠", "J♠", "2♥", "6♥", "7♥"],
  ai:     ["2♣", "8♣", "Q♣", "4♠", "Q♠", "K♠", "7♦", "9♦", "10♦", "Q♦", "3♥", "8♥", "J♥"],
  // the stock from the top down: the first prize, then each card the stock hands out in turn
  stockTop: ["Q♥", "6♦", "2♦", "K♥", "A♠", "10♣", "3♣"],

  // Who plays what, in order. A player step waits for that card; the "skip" step offers the fast-forward.
  script: [
    { who: "player", card: "A♣", text:
      `Welcome to <b>German Whist</b>! You and Hans each hold 13 cards.<br><br>
       The face-up <span class="s-heart">Q♥</span> is the <b>prize</b>, and its suit, hearts, is <b>trump</b> for the whole game.
       Win this trick and the prize is yours. The loser takes the hidden top card of the stock instead.<br><br>
       Lead your <span class="s-club">A♣</span>: only a trump could beat it.` },
    { who: "ai", card: "2♣" },
    { who: "player", card: "3♠", text:
      `The <span class="s-heart">Q♥</span> is yours. Hans took the stock card, and you didn't get to see it.<br><br>
       The new prize is the <span class="s-diamond">2♦</span>, hardly worth having. Lead a low card, your
       <span class="s-spade">3♠</span>, and let Hans win it. You'll get the stock card instead, which could be anything.` },
    { who: "ai", card: "K♠" },
    { who: "ai", card: "7♦" },
    { who: "player", card: "2♥", text:
      `The stock gave you the <span class="s-heart">K♥</span>, a trump king. Good swap!<br><br>
       Hans leads the <span class="s-diamond">7♦</span> to win the <span class="s-spade">A♠</span>. You must follow suit if you can,
       but you have no diamonds, so you may play any card. <b>Any trump beats any other suit</b>: play your
       <span class="s-heart">2♥</span>.` },
    { who: "skip", text:
      `The <span class="s-spade">A♠</span> is yours.<br><br>
       That's Round 1: the tricks don't score, they decide who builds the better hand. Win the prizes worth having and let the poor ones go.<br><br>
       Let's <b>skip ahead</b> to the last trick of Round 1.` }
  ],
  round2:
    `The stock is empty: <b>Round 2</b>.<br><br>
     Now you play out the hands you've built, and only these 13 tricks count. You score a point for every trick over six.
     You've seen every card played, so you can work out exactly what Hans holds.`,
  end:
    `That's how German Whist works: build your hand in Round 1, then win the tricks that count in Round 2.<br><br>
     Now try a real game. On the start screen you can choose your opponent, from Hans up to Max, or play a match to 10 points.`
};

// The fixed deal, in the order GermanWhistGame takes it: 13 to you, 13 to Hans, the rest is the stock
// (the last card is the top).
function tutorialDeck() {
  const parse = s => new Card(s.slice(-1), s.slice(0, -1));
  const used = new Set([...TUTORIAL.player, ...TUTORIAL.ai, ...TUTORIAL.stockTop]);
  const rest = [];
  for (const suit of SUITS) for (const rank of RANKS) if (!used.has(rank + suit)) rest.push(new Card(suit, rank));
  // the rest of the stock in a fixed mixed-up order (the same every time)
  let seed = 7;
  for (let i = rest.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor(seed / 233280 * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [
    ...TUTORIAL.player.map(parse),
    ...TUTORIAL.ai.map(parse),
    ...rest,
    ...TUTORIAL.stockTop.slice().reverse().map(parse)
  ];
}

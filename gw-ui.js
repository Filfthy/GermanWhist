// gw-ui.js - the page around the game: icons, tooltips, popups, fullscreen, More card games, Share and Credits.
// The controller (gw-app.js) drives these; nothing here knows the rules of the game.

const GAME_URL = "https://bug-victim.itch.io/german-whist";
const IS_TOUCH = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

// Corner button icons (drawn, so they look the same everywhere)
const svgIcon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  full: svgIcon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  exitFull: svgIcon('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  sound: svgIcon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  muted: svgIcon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  quit: svgIcon('<path d="M6 6l12 12M18 6L6 18"/>'),
  rules: svgIcon('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8.5 7.5h7M8.5 11h7"/>'),
  gear: svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
};

const GWUI = {
  // ------------------------------------------------------------------ saved settings
  load(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; }
  },
  save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private window: settings just aren't kept */ }
  },

  // ------------------------------------------------------------------ quick tooltips (data-tip)
  initTips() {
    if (IS_TOUCH) return;
    const tip = document.createElement("div");
    tip.id = "tip";
    document.body.appendChild(tip);
    let cur = null;
    const place = el => {
      const r = el.getBoundingClientRect();
      tip.textContent = el.dataset.tip;
      const w = tip.offsetWidth;
      tip.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + "px";
      tip.style.top = (r.bottom + 8) + "px";
      tip.classList.add("on");
    };
    document.addEventListener("mouseover", e => {
      const el = e.target.closest && e.target.closest("[data-tip]");
      if (el === cur) return;
      cur = el;
      if (el) place(el); else tip.classList.remove("on");
    });
    document.addEventListener("mousedown", () => { tip.classList.remove("on"); cur = null; });
  },

  // ------------------------------------------------------------------ popups
  // One popup at a time. A page of the start screen (rules, look & feel) can be lent to it and goes
  // back when it closes, so its settings stay wired up.
  modal(html, cls = "", { borrow = null, onClose = null } = {}) {
    this.closeModal();
    const shade = document.getElementById("modal");
    const panel = shade.querySelector(".modal-panel");
    const body = document.getElementById("modal-body");
    panel.className = "modal-panel" + (cls ? " " + cls : "");
    body.innerHTML = html;
    if (borrow) {
      const slot = body.querySelector(".borrow-slot");
      this._lent = { node: borrow, parent: borrow.parentNode, next: borrow.nextSibling };
      (slot || body).appendChild(borrow);
    }
    this._onClose = onClose;
    shade.style.display = "flex";
    shade.onclick = e => { if (e.target === shade) this.closeModal(); };
    body.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => this.closeModal()));
    const first = body.querySelector("button, a");
    if (first && !IS_TOUCH) setTimeout(() => first.focus(), 30);
    return body;
  },
  closeModal() {
    const shade = document.getElementById("modal");
    if (!shade || shade.style.display === "none") return;
    if (this._lent) {
      const { node, parent, next } = this._lent;
      parent.insertBefore(node, next);
      this._lent = null;
    }
    shade.style.display = "none";
    document.getElementById("modal-body").innerHTML = "";
    const done = this._onClose;
    this._onClose = null;
    if (done) done();
  },
  modalOpen() {
    const shade = document.getElementById("modal");
    return !!shade && shade.style.display !== "none";
  },
  // A question with two answers; resolves true for yes.
  ask(title, text, yes, no) {
    return new Promise(resolve => {
      let answer = false;
      const body = this.modal(`<h2>${title}</h2><p>${text}</p>
        <div class="modal-buttons"><button type="button" class="quiet" id="ask-no">${no}</button><button type="button" id="ask-yes">${yes}</button></div>`,
        "small", { onClose: () => resolve(answer) });
      body.querySelector("#ask-yes").onclick = () => { answer = true; this.closeModal(); };
      body.querySelector("#ask-no").onclick = () => this.closeModal();
    });
  },

  // ------------------------------------------------------------------ More card games, Share, Credits
  showMoreGames() {
    const games = [
      { key: "drakeharbour", soon: true, devices: "Desktop", title: "Drakeharbour Syndicates", description: "Meld cards to found Charters, spend stamina in a painted guild town and complete quests for renown, against up to three computer rivals." },
      { key: "artifact", devices: "Mobile & desktop", title: "Artifact", description: "Tactical space rummy. Collect planet cards and steer a probe to discover alien artifacts, playing against up to three computer opponents." },
      { key: "oh-hell-extended", devices: "Mobile & desktop", title: "Oh Hell! Extended", description: "Bid your tricks, then win exactly that many. Play classic Oh Hell or add Suns, Moons, Dragons and Jokers, against up to four computer opponents." }
    ];
    this.modal(`<h2>More card games</h2><p class="games-intro">Other games by BugVictim.</p>
      <div class="other-games">${games.map(g => `<article class="other-game">
        ${g.soon ? `<div class="game-picture"><span class="soon-ribbon">Coming soon</span><img src="img/more-games-${g.key}.webp" alt="${g.title} artwork" loading="lazy"></div>`
          : `<a class="game-picture" href="https://bug-victim.itch.io/${g.key}" target="_blank" rel="noopener noreferrer" aria-label="Play ${g.title} on itch.io (opens a new tab)"><img src="img/more-games-${g.key}.webp" alt="${g.title} artwork" loading="lazy"></a>`}
        <h3>${g.title}</h3><span class="game-devices">${g.devices}</span><p>${g.description}</p>
        ${g.soon ? '<span class="play-link soon">Coming soon</span>' : `<a class="play-link" href="https://bug-victim.itch.io/${g.key}" target="_blank" rel="noopener noreferrer">Play on itch.io</a>`}
      </article>`).join("")}</div>
      ${this.shareBox()}
      <div class="modal-buttons"><button type="button" data-close>Back</button></div>`, "wide");
    this.bindShareBoxes(document.getElementById("modal-body"));
  },

  // The sharing strip, as on Drakeharbour's start screen: a line of thanks and two buttons, no popup.
  shareBox() {
    return `<div class="share-box">
      <p>Please share with your friends if you enjoy.</p>
      <div class="share-buttons"><button type="button" class="share-action" data-share="share">Share</button><button type="button" class="share-action secondary" data-share="copy">Copy link</button></div>
      <input class="share-link" type="url" readonly aria-label="Game link to copy" hidden>
      <div class="share-status" role="status" aria-live="polite"></div>
    </div>`;
  },
  bindShareBoxes(root = document) {
    root.querySelectorAll(".share-box").forEach(box => {
      if (box._bound) return;
      box._bound = true;
      box.addEventListener("click", e => {
        e.stopPropagation();   // a click here never starts the game from the title screen
        const b = e.target.closest("[data-share]");
        if (!b) return;
        if (b.dataset.share === "share") this.share(box); else this.copyLink(box);
      });
    });
  },
  async share(box) {
    box.querySelector(".share-status").textContent = "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "German Whist", text: "Build your hand, then battle for tricks. Play German Whist.", url: GAME_URL });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    await this.copyLink(box);
  },
  async copyLink(box) {
    const status = box.querySelector(".share-status");
    try {
      await navigator.clipboard.writeText(GAME_URL);
      status.textContent = "Link copied. Share it with a friend!";
      box.querySelector('[data-share="copy"]').textContent = "Copied!";
    } catch (e) {
      const link = box.querySelector(".share-link");
      link.value = GAME_URL;
      link.hidden = false;
      link.focus();
      link.select();
      status.textContent = "Copy the link above to share.";
    }
  },

  showCredits() {
    this.modal(`<h2>Credits</h2><div class="credits">
      <p>Artwork by Pucky.</p>
      <p>Traditional court cards from RevK's SVG playing cards, traced from 1870s Goodall &amp; Son cards (CC0, public domain).</p>
      <p>© BugVictim 2025</p></div>
      <div class="modal-buttons"><button type="button" data-close>Back</button></div>`, "small");
  },

  // ------------------------------------------------------------------ fullscreen
  fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; },
  fsAvailable() { const r = document.documentElement; return !!(r.requestFullscreen || r.webkitRequestFullscreen); },
  enterFull() {
    if (this.fsEl() || !this.fsAvailable()) return;
    const r = document.documentElement;
    try {
      const p = (r.requestFullscreen || r.webkitRequestFullscreen).call(r, { navigationUI: "hide" });
      if (p && p.then) p.then(() => this.lockLandscape()).catch(() => {});
    } catch (e) { /* not allowed here */ }
  },
  exitFull() {
    if (!this.fsEl()) return;
    try { const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  },
  // Phones that allow it stay sideways once the game is fullscreen.
  lockLandscape() {
    if (!IS_TOUCH) return;
    try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape"); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  },

  // ------------------------------------------------------------------ dragging a box by any bare part
  makeDraggable(el, key) {
    const saved = this.load(key, null);
    if (saved) {
      try {
        const { x, y } = JSON.parse(saved);
        el.dataset.x = x; el.dataset.y = y;
      } catch (e) { /* ignore */ }
    }
    const apply = () => {
      if (el.dataset.x == null) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      const x = Math.max(4, Math.min(window.innerWidth - w - 4, +el.dataset.x * window.innerWidth));
      const y = Math.max(4, Math.min(window.innerHeight - h - 4, +el.dataset.y * window.innerHeight));
      el.style.left = x + "px";
      el.style.top = y + "px";
    };
    el._applyPos = apply;
    window.addEventListener("resize", apply);
    let start = null;
    el.addEventListener("pointerdown", e => {
      if (e.target.closest("button, a, input")) return;
      const r = el.getBoundingClientRect();
      start = { px: e.clientX, py: e.clientY, x: r.left, y: r.top };
      el.classList.add("dragging");
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if (!start) return;
      const x = start.x + e.clientX - start.px, y = start.y + e.clientY - start.py;
      el.dataset.x = x / window.innerWidth;
      el.dataset.y = y / window.innerHeight;
      apply();
    });
    const end = () => {
      if (!start) return;
      start = null;
      el.classList.remove("dragging");
      if (el.dataset.x != null) this.save(key, JSON.stringify({ x: +el.dataset.x, y: +el.dataset.y }));
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
};

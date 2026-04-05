# YC Roulette

A Wordle-style mobile game where you guess facts about Y Combinator-backed startups.

**Play it:** [lkpvignesh.github.io/ycroulette](https://lkpvignesh.github.io/ycroulette)

---

## How it works

Each round, you're shown a short description of a real YC startup — no name, just the blurb. You guess:

- **Founding year** — when did they launch?
- **Funding tier** — seed, <$5M, $5–50M, or $50M+?
- **Industry** — Consumer, Fintech, Dev Tools, etc.

Score points for accuracy. 5 startups per game, 150 points max.

---

## Stack

Vanilla HTML, CSS, and JavaScript. No framework, no build step. Single-page app that runs entirely in the browser.

- Fonts: [Nunito](https://fonts.google.com/specimen/Nunito) + [DM Serif Display](https://fonts.google.com/specimen/DM+Serif+Display) via Google Fonts
- Screenshot/share: [html2canvas](https://html2canvas.hertzen.com/)
- Hosting: GitHub Pages

---

## Running locally

```bash
open index.html
```

Or serve it with any static file server:

```bash
python3 -m http.server 8765
# then open http://localhost:8765
```

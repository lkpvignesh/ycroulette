# YC Roulette

A Wordle-style mobile game where players guess facts about YC-backed startups — batch year, industry, funding tier, and founding year. Currently a single-file HTML prototype.

## Project structure

```
index.html           # Main HTML + CSS
game.js              # Game logic (JS)
yc_dataset.js        # 200 curated YC companies (S05–W23)
yc_roulette_prd.docx # Product requirements doc
DESIGN.md            # Approved design doc — ship plan, QA scope, deploy steps
TODOS.md             # Outstanding work items
```

## Tech stack

- Vanilla HTML/CSS/JS — no build step, no framework
- Fonts: Nunito (body) + DM Serif Display (headings) via Google Fonts
- Single-file prototype; `yc_dataset.js` is a standalone script tag

## Design system

CSS custom properties defined in `:root`:

| Token | Value | Use |
|---|---|---|
| `--cream` / `--cream2` / `--cream3` | `#FFF8F0` → `#FFE8D4` | Backgrounds |
| `--orange` / `--orange-dark` | `#E8703A` / `#C45820` | Primary CTA, active states |
| `--green` / `--green-dark` | `#3BAD7A` / `#2A8A5C` | Correct / success states |
| `--sand` / `--sand2` | `#E8D8C4` / `#D4C4B0` | Borders, dividers |
| `--ink` / `--ink2` | `#1E1A16` / `#3A332A` | Body text |
| `--muted` / `--muted2` | `#9A8A7A` / `#C4B4A4` | Secondary text |
| `--radius` / `--radius-sm` | `20px` / `12px` | Border radii |

Phone shell: `360×740px`, centered on a `#F0E8DC` canvas.

## How to preview

Open directly in browser — no server needed:

```bash
open "index.html"
```

Or for gstack QA:
```
file:///Users/vignesh/Personal/Hobby%20Coding/YC%20Roulette/index.html
```

## Dataset schema

Each entry in `YC_STARTUPS`:
```js
{ name, batch, blurb, industry, lastActiveYear, funding }
// funding: "seed" | "<5m" | "5-50m" | "50m+"
// industry: "Consumer" | "Fintech" | "Dev Tools" | "Enterprise SaaS" | "Logistics" | "AI / ML" | "E-commerce" | ...
```

## Deploy Configuration (configured by /setup-deploy)
- Platform: GitHub Pages
- Production URL: https://lkpvignesh.github.io/ycroulette
- Deploy workflow: auto-deploy on push to main (via GitHub Pages)
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: web app (static HTML/JS, no build step)
- Post-deploy health check: https://lkpvignesh.github.io/ycroulette

### Custom deploy hooks
- Pre-merge: none
- Deploy trigger: automatic on push to main (GitHub Pages picks it up)
- Deploy status: poll production URL
- Health check: https://lkpvignesh.github.io/ycroulette

> GitHub Pages setup: repo Settings → Pages → Source: main branch → / (root)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review

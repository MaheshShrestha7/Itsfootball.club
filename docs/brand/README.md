# itsfootball.club logo

The name sits inside a football goal. The dot of the **i** is the ball, flying into the top-left
corner ("top bins"). The goal keeps regulation proportions (7.32 m x 2.44 m, a 3:1 opening) at every
size. Rules for clear space, minimum sizes, colours and misuse: `usage-guide.png`.

| File | Use |
| --- | --- |
| `itsfootball-wordmark.svg` / `-reversed.svg` | Primary logo on light / dark backgrounds (160 px wide and up) |
| `itsfootball-wordmark-small.svg` / `-small-reversed.svg` | No speed lines, for 100-160 px wide |
| `itsfootball-wordmark-black.svg` / `-white.svg` | One colour |
| `itsfootball-icon-app.svg` | App icon tile (`public/icon.png`, `public/logo.png`) |
| `itsfootball-icon-app-small.svg` | App icon at 48 px and below (`public/logo-96.png`) |
| `itsfootball-icon-apple.svg` | Full-bleed square for iOS, which rounds it (`app/apple-icon.png`) |
| `itsfootball-icon-maskable.svg` | Android adaptive icon, mark inside the safe zone (`public/maskable-512.png`) |
| `itsfootball-icon*.svg` | Goal and ball without letters, no tile |
| `itsfootball-favicon.svg` | Browser tab (`app/icon.svg`): drawn on the 16 px grid, frame turns white in dark mode |

`app/favicon.ico` holds hand-drawn 16, 32 and 48 px versions. Don't replace it with a scaled-down
icon: at 16 px the ball blurs into the frame.

In the app, use `components/BrandLogo.tsx` (`BrandWordmark`, `BrandWordmarkSmall`, `BrandIcon`), not
these files. It draws the same paths with the theme tokens (`--text-primary` frame and letters,
`--text-secondary` .club, `--c-green` ball), so one component works in both themes.

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| Goal Navy | `#0F172A` | Frame and letters on light |
| Pitch Black | `#070A0F` | Dark backgrounds |
| Emerald | `#10B981` | Ball on dark, and at favicon sizes |
| Deep Emerald | `#047857` | Ball on light, print |
| Slate / Mist | `#64748B` / `#94A3B8` | `.club` on light / dark |
| Chalk | `#F8FAFC` | Frame and letters on dark |

The ball (and its speed lines) is the only colour; everything else is Navy or Chalk.

Type: Inter Display Medium (SIL Open Font License, which allows logo use), converted to outlines. The
SVGs are paths only: no live text, no strokes, no filters.

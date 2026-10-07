# Basket Protocol design

## Overview

The existing Stock Token vault interface now looks like a neighbourhood supermarket crossed with a space-age arcade at night. A navy sky, purple beams, orange saucer awning, yellow ringed planet and lime/pink script frame the four aisle signs. Below, a pale Memphis pattern surrounds opaque financial panels. The Vault hero contains an original SVG shop with plain boxes, bags, cans and a shopping cart. Decorations contain no prices, numerals, currency, commercial logos or film references.

All six public hash routes remain. Vault, Deposit, Redeem and Docs form the main menu; Owner controls and Losses are footer links. Owner controls, financial figures, the restriction banner and warnings keep plain typography. Existing wording, calculations, transaction arguments, account/chain/runtime verification and simulations remain intact. This document describes the final implementation, not a proposal.

## Colors

The source of truth is `web/src/styles.css`. The original semantic token structure is retained. There is one theme; the night header is a component surface, not a selectable dark theme.

| Token | Value | Role |
| --- | --- | --- |
| `--color-page` | `#f4f2e7` | Pale patterned page |
| `--color-surface` | `#fffef8` | Opaque financial/content panels |
| `--color-text` | `#18253c` | Main plain text and numbers |
| `--color-muted` | `#505967` | Supporting copy and labels |
| `--color-line` | `#e6e9e5` | Separators, neutral notes, disabled fills |
| `--color-border` | `#767d88` | Controls and panel boundaries |
| `--color-accent` / `--color-accent-hover` | `#17625c` / `#104b46` | Links and primary transaction actions |
| `--color-soft` | `#e2f2ec` | Explanatory aside panels |
| `--color-warning-bg` / `--color-warning` | `#fff1cb` / `#654810` | Banner, warnings, consequence confirmations |
| `--color-error-bg` / `--color-error` | `#f9e7df` / `#8e3021` | Read errors and inline errors |
| `--color-focus` | `#174ccc` | Three-pixel focus ring on light surfaces |
| `--color-night` | `#111a31` | Header, wallet backdrop, arcade title panels |
| `--color-neon-lime` / `--color-neon-pink` | `#d9f789` / `#ffa4da` | Script display text and aisle signs |
| `--color-neon-teal` | `#83ddd0` | Header accents and Vault aisle sign |
| `--color-sign-yellow` / `--color-sign-purple` | `#ffe27d` / `#d4bbf5` | Redeem/Docs signs; yellow focus on navy |

Artwork has its own SVG fills; these do not style warnings or financial values. Never place data over illustration, glow or pattern. Measured rendered text pairs and their exact ratios are recorded in `artifacts/browser-regressions.json` and `artifacts/browser-redesign.json`.

## Typography

- **Script:** locally bundled Damion Regular, 400, normal style, with Brush Script MT/Georgia/serif fallback. `web/src/assets/Damion-Regular.ttf` is served as a Vite hashed asset. Its SIL OFL notice is retained in `web/public/fonts/OFL.txt` and the export. No font service is contacted. Font loading uses `swap`.
- **Body and data:** Arial, Helvetica, sans-serif, 16px root, line-height 1.55, tabular numerals. Buttons, form labels, amounts, errors, warnings and account/address values never use the script face.
- **Section headings:** Georgia/Times New Roman/serif, h2 1.75rem, bold; h3 1.25rem, semibold. Owner action headings remain plain.
- **Display headings:** title panels use `clamp(2.2rem, 4.6vw, 3.5rem)`; Vault uses `clamp(2.5rem, 4.6vw, 4rem)` and 2.55rem below 34rem. Line-height 1.09–1.1. Brand scales 2.5–3.75rem on desktop and 2.3rem on narrow phones.
- **Labels and metadata:** 0.875rem labels; 0.8125rem small text. The inherited compact role-address text is 0.6875rem. The restriction banner is 0.8125rem, then 0.75rem on narrow phones. Inputs remain 1rem.
- Financial metrics use sans-serif, 2.3rem desktop, 2rem on phones; the cap uses a smaller 1.65rem value and 1.1rem denominator. Descriptions cap at 65–75ch, headings balance, paragraphs use pretty wrapping, addresses wrap anywhere and remain selectable.

## Layout

`main`, the header content, menu and footer align to a 1200px maximum width. Below 80rem, horizontal margins are 2rem; below 45rem, 1.25rem; below 34rem, 1rem. Group gaps generally use 1–1.5rem; owner sections use 3rem separation. Financial panel padding is 1.75rem, reducing to 1.2rem on phones.

The Vault has a two-column arcade hero, three metric panels and three stock cards across at large widths. The hero stacks below 45rem, retaining the shop illustration on phones. Stock cards are two across below 60rem and one below 45rem; metrics stack below 34rem. The existing card fields, prices, availability and address links are retained.

Deposit and Redeem use a 1.25:1 form/aside grid, stacking below 45rem. Owner actions and Docs use two columns that become one. Claim controls stack on phones. Description lists can wrap long amounts and timestamps, and addresses break without cutting off their values.

`Pairings` in `web/src/Owner.tsx` retains its desktop table. Below 45rem each row becomes a bordered stock card with the same symbol, token address, feed description, warning, feed address and current price. The table header is visually clipped, retaining semantic table headings; repeated visible mobile field labels are hidden from assistive technology. Both pasted launch previews and existing pairings share the component.

All six pages were checked at 320, 375, 768 and 1440 CSS pixels. Every visible link, button and disclosure is at least 44px tall at 375 and 1440. Navigation wraps within the viewport; the footer links are small in type but retain 44px targets. There is no page-level horizontal overflow at the checked widths. This is browser emulation, not a physical-phone test.

## Elevation & Depth

Solid borders communicate data/control boundaries. Financial panels have restrained 3px offset shadows; title panels have a 4px base shadow. The Vault hero uses a double arcade bezel with an inset shadow. Aisle signs have short colored base shadows. Script headings have subtle glow; body copy never does. Original SVG beams and saucer gradients remain confined to the header background. The wallet has a solid navy backing so scenery cannot obscure account or chain text.

## Shapes

Control radii are 6–7px, ordinary panels 8px, title panels 14px at the top/5px at the bottom, and the Vault arcade panel 22px at the top/8px at the bottom. Financial receipts use a square border with a dashed top. Stock status badges keep small rectangular borders. Checkerboard separators appear below the header and above the footer; they contain no figures or labels.

## Components

- `NightSky`, `Planet`, `Storefront` (`web/src/Scenery.tsx`): original inline SVG primitives. Non-interactive, `aria-hidden`, non-focusable. The background squiggles, triangles and confetti are in `web/src/assets/memphis.svg`; the shelf glass supplies the grid pattern. No external image service or artwork library.
- `PageTitle`, `Note`, `Empty`, `AddressLink`, `RoleInfo`, `TxButton` (`web/src/components.tsx`): existing shared components. Title decoration is CSS; warnings and transaction semantics remain unchanged. `Note` retains its warning variant and `TxButton` retains role, busy, disabled and simulation behavior.
- Main navigation (`web/src/main.tsx`): ordinary hash links, `aria-current`, white selected border plus underline. Routes focus h1. The skip link is clipped until keyboard focus, then moves focus into main content. Header focus is yellow; ordinary content focus is blue.
- Financial cards (`web/src/Vault.tsx`): unchanged number formatting, stock symbols and values. `DepositState` remains the source of availability wording. The existing Basket/BASK illustration caption remains outside the plain data panels.
- Forms and receipts (`web/src/Flows.tsx`): persistent visible labels, native required fields, inline errors and polite receipt/status updates. The wallet publishes a success revision only after a successful receipt. Layout effects clear previews before paint on every confirmed send, cancel obsolete asynchronous preview results, and clear the amount after a deposit. `Deposit confirmed` retains the existing transaction link. Another amount and explicit preview are required to restore send buttons. Approval keeps its amount but invalidates its old quote.
- Claims stay visible on Redeem. The component stays mounted under a native `hidden` wrapper on other pages to preserve the existing claim reads and their timing.
- Owner action panels retain plain buttons, public role information, required confirmations, pairing checks, pagination and simulations. They are not decorated as arcade game controls.

Only a 120ms press transform animates buttons, inside `prefers-reduced-motion: no-preference`; no continuous animation runs. Background-color interpolation was removed so newly enabled buttons have their high-contrast colors immediately. Reduced motion removes all animation/transitions. Forced-colors rules retain system focus and control borders.

## Do's and Don'ts

Reuse `PageTitle` and `.panel` for a future approved page, then select `.flow-layout`, `.two-col` or `.docs-grid` according to the existing content structure. Reuse `Note` for actual warnings and keep numerical content inside opaque surfaces. Continue the current hash navigation and exact contract-binding code.

Keep the banner, warnings, Docs copy and transaction labels verbatim. Use Stock Tokens, token `symbol()` values and the existing feed-description cleaner. The chain name is the only permitted use of its issuer name. Keep commercial brands, film characters, numbers, currency and fake price tags out of decoration. Do not put script typography on financial data or owner buttons. Do not add remote fonts, analytics, image APIs, new reads or contract behavior for visual polish.

The six-domain review, fixes and limits are in `artifacts/validation.md`. Guidance attribution: Better Interface by Jakub Krehel (MIT), pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`; documentation method adapted from Paul Bakaus's Impeccable (Apache-2.0), commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. Their existing notices/licenses remain in `web/validation/DESIGN-GUIDANCE-LICENSE`. This document has been rewritten to describe the implemented redesign.

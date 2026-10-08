# Basket Protocol design

## Overview

A loud, cheerful 1990s supermarket weekly flyer for visitors reading vault 5 and using a wallet to deposit, redeem or manage Stock Tokens. Every route shares the store-sign header, hanging aisle navigation, stocked shelves, sky-blue surround and checkerboard floor. Figures, warnings and owner controls use plain white surfaces. The illustrated clerk with a bow tie belongs to the Vault hero.

## Colors

Canonical tokens live in `web/src/styles.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--sky` | `#8ad1f2` | Page surround |
| `--sun` | `#ffdb29` | Thick flyer frames, marquee, store sign accents |
| `--red` | `#df2029` | Outer frames and store sign |
| `--royal` | `#174bc1` | Header, title panels, links and primary actions |
| `--ink` | `#142c54` | Body text, controls and focus perimeter |
| `--paper` | `#ffffff` | Financial data and form surfaces |
| `--subtle` | `#edf5ff` | Supporting read/status blocks |
| `--warning` | `#fff5c4` | Warning and confirmation surfaces |
| `--error` | `#a01520` | Error text and pairing marks |
| `--line` | `#8091ae` | Input and receipt borders |

Status always has words; color alone never carries a check result. There is one light theme. Measured contrast results and scope are in `artifacts/validation.md`.

## Typography

Anton (`Flyer`) is a local regular WOFF2 face for chunky condensed uppercase headings and the store sign. VT323 (`Pixel`) is a local regular WOFF2 face for the marquee and small accent labels. Body, forms, warnings and numbers use Arial/Helvetica/system sans at 16px and line-height 1.5. Address strings use monospace. Font licenses are local. No external font request is needed.

H1 is 64px on desktop and 36px on phones. Title eyebrows use bold Arial at 14px/20px to avoid pixel-font shimmer on scaled displays. H2 is 32px (30px on phones), H3 25px (24px on phones). Headings use line-height 1.125 and balanced wrapping. Body measure is at most 70–75 characters for prose. Numbers use tabular numerals; quantities and addresses wrap without losing their full value. Inputs stay at 16px to avoid phone focus zoom. Native bold remains distinct in the system body family; local display faces use only their supplied regular weight.

## Layout

The content maximum is 1200px, with 20px desktop and 16px phone gutters. Flyer panels have 24px padding, 24px gaps and thick colored frames. Forms and details group within panels. The Vault hero uses a flexible title and 285px illustration column; on phones its small clerk sits at the lower right, outside the title's text area.

At 960px, stock cards fall from three columns to two; role and owner grids become one column. At 660px, stock cards, forms, docs and claims use one column; the menu retains four legible hanging signs. Metric panels retain two columns. Each stock is a complete phone card with explicit field labels, not a horizontally scrolling table. The data refresh action stays beside its status. Phones omit the duplicate global transaction summary, keeping the status beside its action. Phone header, title and shelf spacing is reduced so task guidance appears sooner. Long addresses wrap. Required screenshots cover 1440px and 375px; additional checks and their limits are recorded with validation.

## Elevation & Depth

This is a flat print-inspired system. Flyer panels use a 5px sunshine border with a 3px red outer frame. Nested panels use 2px royal-blue borders. The sign and hanging menu use solid offset ink shadows. All text stays unrotated and in normal document flow; only the paint-contained slogan track moves. White receipt/data panels contain no decorative texture.

## Shapes

Panels and receipts are rectangular; controls use 3px corner radii and at least 44px height. Original SVG art shows plain cans, bottles, boxes, produce, a shopper unloading a basket and a cashier handing over a full bag. Word-only starbursts use a CSS polygon and carry only WOW! or Fresh! The only checker pattern is a decorative floor/title strip. Decoration has no currency, numerical labels, real product marks or borrowed characters.

## Components

- `components.tsx`: `PageTitle`, `Note`, `Empty`, `Addr`, `AddressLink`, `RoleInfo`, `TxButton`, `ActionStatus`, `DisabledReason`, `Receiver`, and the basket mark. Reuse these for hierarchy, warnings, readable addresses and guarded actions.
- `Scenery.tsx`: `Marquee`, `StoreShelf`, `Clerk`, `Checkout`. The shelf is decorative; both checkout scenes and the clerk have concise accessible descriptions. Shelf packages repeat at a fixed aspect ratio across the frame. The marquee can be paused and its animation is disabled for reduced motion. Eight identical slogan units cover desktop widths through 2560px; phones retain the original two-repeat text and 45-second loop.
- `Vault.tsx`: metric cards, stock cards and `DepositState`. Symbol, state, held amount, NAV share and failed checks remain visible; Details reveals feed and pool data. A search filters cards without changing contract order. Price status comes from contract reasons; reasons 9–11 explicitly say the pool check was not run. Unreadable values are spelled out, never shown as a real zero.
- `Flows.tsx`: decimal amount fields, exact Use full balance controls, search-to-add stocks, previews immediately after selected amounts, named approval steps and owed-first claim cards. Claim all precedes the cards; zero balances fold away. Receivers remain full, wrapped and labelled. Preview data is invalidated when inputs/accounts change and after successful deposits.
- `Owner.tsx`: `ActionForm`, pairing cards, genesis sequence, settings and pending proposal cards. Forms use native details disclosures. Stock selectors begin on Choose a stock, retain an existing choice across reads and clear it when the stock disappears. Launch folds to one done line; Pause, Pending and Immediate precede proposal forms. Jump controls scroll and focus without a route change. Consequential irreversible actions require an explicit checkbox; unauthorized controls remain visible and disabled. Financial buttons use system text rather than display lettering.

All controls use native elements and visible labels. Focus has a 3px ink perimeter with a sunshine surround. Hash navigation focuses the page H1; a skip link reaches main content. Errors use alert regions, transaction progress uses a status region, and read failures offer Retry. Disabled buttons have nearby reasons and recovery controls. Primary hover/focus/active states explicitly keep white text on ink; disabled primary buttons use the same legible muted palette as other disabled controls. Action-local status retains transaction links and reports confirmed refreshes, proposal IDs/ready times and remaining owed amounts. Loading says Reading...; failure says unreadable with Retry. Balance and claim Retry controls appear only after failed reads; a successful empty claim read says that nothing is owed. Claim and loss result scopes include the token address so equal symbols cannot overwrite one another’s result. Motion is limited to the optional slow marquee and color-only control feedback. Buttons no longer scale text on press. Forced-colors focus uses the system Highlight color.

## Do's and Don'ts

Start new content with `PageTitle` and a `.panel`, then reuse the existing grid and card primitives. Keep the banner, full addresses, issuer-prefix cleaning and `check this pairing` text intact. Use Stock Tokens in prose. Keep all real quantities and transaction warnings in plain data surfaces, with the correct on-chain decimals.

Keep the supermarket immediately recognizable on every page. Add only original SVG or CSS art. Avoid astronomical imagery, arcade styling, brand/product logos, numerical decoration, performance slogans and implied claims about returns, safety or market opening. Shopping slogans remain about baskets, aisles and carts. Do not add fixed deposit schedules or stale-price rules in the interface; read the vault's settings and reasons.

Native Windows Chrome/Edge at 100%, 125% and 150% display scaling and physical phones require external verification; Linux Chromium DPR geometry checks do not establish their rasterization behavior. See the validation report for actual results.

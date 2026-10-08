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

Anton (`Flyer`) is a local regular WOFF2 face for chunky condensed uppercase headings and the store sign. VT323 (`Pixel`) is a local regular WOFF2 face for the marquee and small accent labels. Body, forms, warnings and numbers use Arial/Helvetica/system sans at 16px and line-height 1.55. Address strings use monospace. Font licenses are local. No external font request is needed.

H1 scales from 40px to 76px; phones use 45px. H2 is 32px (30px on phones), H3 25px (24px on phones). Headings use line-height 1.12 and balanced wrapping. Body measure is at most 70–75 characters for prose. Numbers use tabular numerals; quantities and addresses wrap without losing their full value. Inputs stay at 16px to avoid phone focus zoom. Native bold remains distinct in the system body family; local display faces use only their supplied regular weight.

## Layout

The content maximum is 1200px, with 20px desktop and 16px phone gutters. Flyer panels have 24px padding, 24px gaps and thick colored frames. Forms and details group within panels. The Vault hero uses a flexible title and 285px illustration column; on phones its small clerk sits at the lower right, outside the title's text area.

At 960px, stock cards fall from three columns to two; role and owner grids become one column. At 660px, stock cards, forms, docs and claims use one column; the menu retains four legible hanging signs. Metric panels retain two columns. Each stock is a complete phone card with explicit field labels, not a horizontally scrolling table. The data retry action becomes full width. Long addresses wrap. Required screenshots cover 1440px and 375px; additional checks and their limits are recorded with validation.

## Elevation & Depth

This is a flat print-inspired system. Flyer panels use a 5px sunshine border with a 3px red outer frame. Nested panels use 2px royal-blue borders. The sign and hanging menu use solid offset ink shadows. The store sign alone tilts slightly. White receipt/data panels contain no decorative texture.

## Shapes

Panels and receipts are rectangular; controls use 3px corner radii and at least 44px height. Original SVG art shows plain cans, bottles, boxes, produce, a cart, a checkout belt and fluorescent fixtures. Word-only starbursts use a CSS polygon and carry only WOW! or Fresh! The only checker pattern is a decorative floor/title strip. Decoration has no currency, numerical labels, real product marks or borrowed characters.

## Components

- `components.tsx`: `PageTitle`, `Note`, `Empty`, `Addr`, `AddressLink`, `RoleInfo`, `TxButton`, and the basket mark. Reuse these for hierarchy, warnings, readable addresses and guarded actions.
- `Scenery.tsx`: `Marquee`, `StoreShelf`, `Clerk`, `Checkout`. Shelves and checkout art are hidden from assistive technology; the clerk has a concise accessible description. The marquee can be paused and its animation is disabled for reduced motion.
- `Vault.tsx`: metric cards, stock cards and `DepositState`. Price status comes from contract reasons. Unreadable values are spelled out, never shown as a real zero.
- `Flows.tsx`: decimal amount fields, previews, exact approval sequence, claim cards. Preview data is invalidated when inputs/accounts change and after successful deposits.
- `Owner.tsx`: `ActionForm`, pairing cards, genesis sequence, settings and pending proposal cards. Consequential irreversible actions require an explicit checkbox; unauthorized controls remain visible and disabled. Financial buttons use system text rather than display lettering.

All controls use native elements and visible labels. Focus has a 3px ink perimeter with a sunshine surround. Hash navigation focuses the page H1; a skip link reaches main content. Errors use alert regions, transaction progress uses a status region, and read failures offer Retry. Disabled, hover, pending, empty and error states have explicit styles. Motion is limited to the optional slow marquee and short control feedback. Forced-colors focus uses the system Highlight color.

## Do's and Don'ts

Start new content with `PageTitle` and a `.panel`, then reuse the existing grid and card primitives. Keep the banner, full addresses, issuer-prefix cleaning and `check this pairing` text intact. Use Stock Tokens in prose. Keep all real quantities and transaction warnings in plain data surfaces, with the correct on-chain decimals.

Keep the supermarket immediately recognizable on every page. Add only original SVG or CSS art. Avoid astronomical imagery, arcade styling, brand/product logos, numerical decoration, performance slogans and implied claims about returns, safety or market opening. Shopping slogans remain about baskets, aisles and carts. Do not add fixed deposit schedules or stale-price rules in the interface; read the vault's settings and reasons.

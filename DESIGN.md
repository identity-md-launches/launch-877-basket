# Basket Protocol design

## Overview

A loud, cheerful 1990s supermarket weekly flyer for visitors reading vault 6 (BaskVault `0x739fd5b653aa092a434534fa1ade67c1770b5a5b` on Robinhood Chain) and using a wallet to deposit, redeem or manage Stock Tokens. Every route shares the store-sign header, hanging aisle navigation, stocked shelves, sky-blue surround and checkerboard floor. Figures, warnings and owner controls use plain white surfaces. The owner’s store worker is the only person on the site, in three supplied poses for Vault, Deposit and Redeem.

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

The content maximum is 1200px, with 20px desktop and 16px phone gutters. Flyer panels have 24px padding, 24px gaps and thick colored frames. Forms and details group within panels. The Vault hero uses a flexible title and 380px illustration column (320px at 661–960px). Its checker strip stays at the title’s bottom. At 660px and below, the picture frame spans the full width directly beneath the title, with WOW! retained.

At 960px, stock cards fall from three columns to two; role and owner grids become one column. At 660px, stock cards, forms, docs and claims use one column; the menu retains four legible hanging signs. Metric panels retain two columns. Each stock is a complete phone card with explicit field labels, not a horizontally scrolling table. The data refresh action stays beside its status. Phones omit the duplicate global transaction summary, keeping the status beside its action. Phone header, title and shelf spacing is reduced so task guidance appears sooner. Long addresses wrap. Required screenshots cover 1440px and 375px; additional checks and their limits are recorded with validation.

## Elevation & Depth

This is a flat print-inspired system. Flyer panels use a 5px sunshine border with a 3px red outer frame. Nested panels use 2px royal-blue borders. The sign and hanging menu use solid offset ink shadows. All text stays unrotated and in normal document flow; only the overflow-clipped slogan track moves. White receipt/data panels contain no decorative texture.

## Shapes

Panels and receipts are rectangular; controls use 3px corner radii and at least 44px height. Art combines original SVG/CSS with the manifest files kept byte for byte: the owner’s character (the only person on the site) and Microsoft Fluent Emoji flat food (MIT). The three pictures show a produce crate, an offered basket and a full grocery bag. The project’s BASKET PROTOCOL name badge is allowed. Word-only starbursts use a CSS polygon and carry only WOW! or Fresh! The only checker pattern is a decorative floor/title strip. Decoration has no currency, numerical labels, real product marks or borrowed characters.

## Components

- `components.tsx`: `PageTitle`, `Note`, `Empty`, `Addr`, `AddressLink`, `RoleInfo`, `TxButton`, `ActionStatus`, `DisabledReason`, `Receiver`, and the basket mark. Reuse these for hierarchy, warnings, readable addresses and guarded actions.
- `Scenery.tsx`: `Marquee` and `StoreShelf`. The two decorative shelf rows use empty-alt local images: the first 14 food SVGs in manifest order above, then the next 19 below, each list repeated five times and clipped without motion. The light-blue back wall is `#c4e7ff`; red planks have ink edges. Desktop icons are 40px squares with 12px gaps in a 120px strip. Phones use 22px squares, 8px gaps and 3px planks in a 50px strip, with a 4px gap above the shelf frame; this preserves the previous above-fold messages at 375×812. Both shelf locations share this system.
- `Marquee` has two identical halves, each four copies of the unchanged slogans and at least one viewport wide. Only `overflow: hidden` clips the window; the moving track has `will-change: transform`. It loops from 0 to −50% in 180 seconds on desktop and 45 seconds on phones. There is no pause, stop or hide control, per the owner’s decision. Animation runs only under `prefers-reduced-motion: no-preference`; reduced motion is static.
- `.character-picture` uses each manifest width/height, `display: block`, `width: 100%`, `object-fit: contain` and `object-position: 50% 100%`. Vault picture heights are 300/260/200px; flow pictures are 320/260/240px at desktop/tablet/phone widths. Frames grow to accommodate speech. At the narrowest tablet aside widths, the Redeem bubble sits above-left of the head with a downward tail, reserving space above the bag; phone bubbles sit alongside the head. Deposit and Redeem stages use sunshine with 4px red borders. Speech stays still in white rounded bubbles with 3px ink borders and tails, in Flyer at 18px/1.4 (15px on phones); copy retains its supplied case. Each picture has its assigned descriptive alt text. No image is cropped, stretched, recolored or animated.
- `Vault.tsx`: metric cards, stock cards and `DepositState`. Symbol, state, held amount, NAV share and failed checks remain visible; Details reveals feed and pool data. A search filters cards without changing contract order. Price status comes from contract reasons (fifteen, in `BaskVault.Reason` order); reasons 9–11 explicitly say the pool check was not run. `DepositState` (also on Deposit) prints the hours in New York words plus the raw seconds, and for reason 3 says when deposits reopen (weekday, New York time, date, countdown and the visitor's local time) and for reason 14 that they wait for a price update, computed by `newYork.ts` from `settings()` and the latest block timestamp. Unreadable values are spelled out, never shown as a real zero.
- `Flows.tsx`: decimal amount fields, exact Use full balance controls, search-to-add stocks, previews immediately after selected amounts, named approval steps and owed-first claim cards. Claim all precedes the cards; zero balances fold away. Receivers remain full, wrapped and labelled. Preview data is invalidated when inputs/accounts change and after successful deposits.
- `Owner.tsx`: `ActionForm`, pairing cards, genesis sequence (`listGenesis`, `finalizeGenesis`), settings and pending proposal cards built from `pendingProposals` ids and `proposal(id)`, executable from two to nine days after creation. The Hours setting shows the current schedule in words and raw seconds and takes From and To as a weekday plus New York time (or "Always open"), previewing value, value2 and words; Dst shows its three rule words; FreshCount and FreshHours explain the market-holiday closure. Proposals send the `BaskVault.Action` struct. Forms use native details disclosures. Stock selectors begin on Choose a stock, retain an existing choice across reads and clear it when the stock disappears. Launch folds to one done line; Pause, Pending and Immediate precede proposal forms. Jump controls scroll and focus without a route change. Consequential irreversible actions require an explicit checkbox; unauthorized controls remain visible and disabled. Financial buttons use system text rather than display lettering.

All controls use native elements and visible labels. Focus has a 3px ink perimeter with a sunshine surround. Hash navigation focuses the page H1; a skip link reaches main content. Errors use alert regions, transaction progress uses a status region, and read failures offer Retry. Disabled buttons have nearby reasons and recovery controls. Primary hover/focus/active states explicitly keep white text on ink; disabled primary buttons use the same legible muted palette as other disabled controls. Action-local status retains transaction links and reports confirmed refreshes, proposal IDs/ready times and remaining owed amounts. Loading says Reading...; failure says unreadable with Retry. Balance and claim Retry controls appear only after failed reads; a complete, successful empty claim read says that nothing is owed. Incomplete stock reads say “Owed balances unreadable. Retry vault.” with Retry vault. Claim and loss result scopes include the token address so equal symbols cannot overwrite one another’s result. Motion is limited to the continuously running slow marquee (unless reduced motion is requested) and color-only control feedback. Buttons no longer scale text on press. Forced-colors focus uses the system Highlight color.

## Do's and Don'ts

Start new content with `PageTitle` and a `.panel`, then reuse the existing grid and card primitives. Keep the banner, full addresses, issuer-prefix cleaning and `check this pairing` text intact. Use Stock Tokens in prose. Keep all real quantities and transaction warnings in plain data surfaces, with the correct on-chain decimals.

Keep the supermarket immediately recognizable on every page. Art must be original SVG/CSS plus the manifest files kept byte for byte: the owner’s character and Fluent Emoji food (MIT). Load manifest art only through local `./art/...` image sources in TSX; never inline, import, re-encode or reference it from CSS. Avoid astronomical imagery, arcade styling, brand/product logos, numerical decoration, performance slogans and implied claims about returns, safety or market opening. Shopping slogans remain about baskets, aisles and carts. Docs may state the published schedule ("deposits open Sunday 8 pm to Friday 8 pm New York time, closed on US market holidays, redemptions always open"); everything else reads `settings()` and `depositStatus` and never the browser time zone.

Native Windows Chrome/Edge at 100%, 125% and 150% display scaling and physical phones require external verification; Linux Chromium DPR geometry checks do not establish their rasterization behavior. See the validation report for actual results.

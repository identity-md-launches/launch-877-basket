# Basket Protocol website design

## Overview

A public vault interface for holders of Basket (BASK), Stock Token depositors, and vault operators. The grocery-store direction uses a shopping basket, a small hanging BASK tag, green shelf edges and cream surfaces. Financial values, restrictions and irreversible actions use plain language. The five hash-routed pages share one header, restriction banner, navigation and footer.

The implemented source of truth is `web/src/styles.css`, with shared elements in `web/src/components.tsx`. There is no component framework, external font, stock photography, chart library, dark theme or animation dependency.

## Colors

Primitives feed semantic custom properties; use the semantic property in components.

| Semantic token | Final value | Use |
| --- | --- | --- |
| `--color-page` | `#f8f6ed` | Cream page and receipt backgrounds |
| `--color-surface` | `#fffef9` | Header, cards, inputs and secondary buttons |
| `--color-text` | `#292e26` | Main copy and numbers |
| `--color-muted` | `#66695f` | Supporting copy, labels, timestamps |
| `--color-line` | `#eceadd` | Structural dividers, inactive fills |
| `--color-border` | `#8c897b` | Input/button boundaries and dashed receipt rules |
| `--color-accent` | `#24513c` | Primary actions, active navigation, basket outlines |
| `--color-accent-hover` | `#173e2b` | Primary button hover |
| `--color-soft` | `#e5eddf` | Grocery illustration and explanatory side panels |
| `--color-warning-bg` / `--color-warning` | `#fff1cb` / `#654810` | Restriction banner and consequential confirmations |
| `--color-error-bg` / `--color-error` | `#f9e7df` / `#8e3021` | Read failures and form errors |
| `--color-focus` | `#185bac` | Three-pixel keyboard outline, offset three pixels |

Produce shapes use decorative ochre `#ddb877`, leaf `#8caa70` and terracotta `#cf7b50`; these do not encode financial status. State always has a text label. Measured rendered pairs and limitations are in `artifacts/validation.md`.

## Typography

Body: `Arial, Helvetica, sans-serif`, browser/system supplied. Display: `Georgia, 'Times New Roman', serif`. Addresses: `ui-monospace, SFMono-Regular, Consolas, monospace`. No font download is required; exact glyphs depend on the platform.

The body is 16px with 1.55 line height. Supporting text is 14px, small text 13px, compact eyebrow text 11px. Fields stay at 16px. H3 is 20px/1.35, H2 28px/1.2, page titles clamp from 36px to 60px/1.09. The vault hero alone clamps from 43.2px to 68.8px; its second line is green italic serif. Display headings use weight 400, tight tracking (`-.035em`) and balanced wrapping. UI emphasis requests weight 600, resolved by installed system fonts. This is not a claim of bundled 600-weight font files.

Numbers use tabular numerals. Copy has a maximum measure of 75 characters; explanatory copy generally uses 41–68 characters. Addresses wrap instead of being clipped. Feed descriptions preserve whitespace and case with `.chain-text` and bidirectional isolation. Stock labels come from `symbol()` only. Full precision remains in bigint calculations and transaction arguments; display values are formatted for reading.

## Layout

The shared desktop content width is 1200px. Page sections use normal document flow; there are no blocking overlays or sticky actions. Typical spacing is 8px within a group, 12–20px between controls/cards, 24–32px inside panels, and 48px between owner sections.

- `.stats`: three shelf tags; the cap tag spans the second row below 45rem.
- `.stock-grid`: three columns, two below 60rem, one below 34rem.
- `.flow-layout`: main form and explanatory panel; one column below 45rem.
- `.two-col`: owner/loss cards; one column below 45rem.
- `.launch-steps`: stacked listing form, pairing table and genesis confirmation, in that order.
- `.roles`: three address columns; stacked below 60rem.
- `.claim-row`: amount, recipient and button; wraps at 60rem and stacks at 45rem.
- At 80rem, shared gutters become 32px; at 45rem, 20px; at 34rem, 16px.
- Navigation remains visible on small screens. Decorative navigation numbers disappear below 45rem; the large basket illustration disappears below 34rem.
- The pairing table has a named, keyboard-focusable horizontal scroll region on narrow screens. Page content itself reflows without horizontal overflow.

Browser evidence covers 320px, 768px and 1440px widths, both empty and populated states, plus desktop text enlargement. Physical devices and native browser zoom are separate unperformed checks.

## Elevation & Depth

Mostly flat surfaces. Borders communicate grouping, state or controls. The illustration's hanging tag has a small `3px 5px 0 #292e2610` shadow; decorative shelf depth uses a second horizontal rule. Cards do not float or animate into view.

## Shapes

Panels use 10px radii, stock cards 8px, notes/buttons 7px, fields 6px and receipts 5px. Thin borders and dashed receipt lines evoke shelf labels without obscuring amounts. The price cards have a 4px green top edge. The SVG basket and favicon are original local vector assets; decorative icons are hidden from assistive technology.

## Components

| Source / component | Behavior |
| --- | --- |
| `components.tsx`: `PageTitle`, `Empty`, `Note` | Shared heading, empty-state and warning patterns; no dismissible essential warnings |
| `components.tsx`: `BasketIcon`, `Addr`, `AddressLink` | Reusable basket drawing, wrapping full addresses, explorer links |
| `components.tsx`: `RoleInfo`, `TxButton` | Visible allowed role/address; disabled unavailable actions; local error feedback and transaction state |
| `Owner.tsx`: `ActionForm` | Native labels, fields, selects, checkboxes and submit; immutable-action confirmations; form errors and focus return |
| `Vault.tsx`: `DepositState` | Plain deposit reason and stock at fault; zero fault is “none” |
| `Flows.tsx`: receipt / claim patterns | Fee, net amount and minimum together; connected-wallet claims on every page |
| `main.tsx`: site shell | Exact restriction banner, five hash links, active `aria-current`, refresh status, wallet status and skip link |

The primary green fill identifies the main action. Approval/deposit emphasis follows the allowance state. Other actions use neutral bordered buttons. Native controls provide keyboard behavior. Buttons have at least 44px height except the 40px refresh control; page navigation and text links follow their native semantics. Focus is visible; forced-colors uses system colors. Button press scaling (`.96`) and 120ms transitions are enabled only with `prefers-reduced-motion: no-preference`. No load animation is used.

## Do's and Don'ts

Reuse the panel, flow, receipt, note and role components. Keep irreversible-action wording beside its checkbox. Keep all public information visible regardless of wallet role. Use plain numbers and exact chain text; never substitute a Stock Token's `name()` for its symbol. Preserve full precision in transaction arguments. Add no unrelated pages, analytics, theme switches or marketing claims.

Design review used the pinned Better Interface guide (Jakub Krehel, MIT) and documentation guidance adapted from Impeccable (Paul Bakaus, Apache-2.0). Attribution and both licenses are retained in `web/validation/DESIGN-GUIDANCE-LICENSE`; review evidence is in `artifacts/validation.md`.

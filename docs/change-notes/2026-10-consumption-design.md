# Consumption design and historical classification (v0.7.7)

The v0.7.6 consumption surface implemented analysis but did not fully implement the approved layout. Historical statement purchases also inherited a blanket `기타` category. This release implements the donut/legend, ranked items, category/item filters, summary/transaction tabs, month/year controls, issuer/manual entry tabs, and purchase footer using existing theme tokens and shared sheets.

## Financial preservation

- Display overrides are stored in `settings.spendingClassifications`, keyed by original purchase transaction ID. No financial ledger, schedule, bill, payment, cash amount, or approval identity is rewritten.
- Historical statement imports with the old `기타` default display exact merchant `조이시티` as `게임·취미`; other unverified purposes display `미분류`. Explicit user overrides, including `기타`, take precedence. Merchant name alone is not used to infer a specific product.
- Refund display identity resolves its original purchase even when the original is archived historical evidence. Analysis eligibility and amount rules are unchanged.
- Saving an override rolls back on a rejected or thrown persistence result. Distinct transactions remain independent even if merchant/date/amount match.
- ZIP roundtrip checks exposed non-idempotent normalization of missing `productId`. Newly created card liabilities and appended linked base accounts now canonicalize it to the existing empty-string default. No amount, date or identifier changes.

## Verification scope

Synthetic unit/browser coverage checks source collection equality, independent purchases, refunds, persistence rollback, ZIP/reload, themes and 320/412/768px layouts. Purchase footer visibility is checked at these widths. Shared month controls remain common to all integrated tabs.

A separate private QA copy of the latest available source snapshot was used to check actual imported card labels and exact financial preservation. Cloud requests were blocked in that browser context; operating writes were zero. Personal records and screenshots are excluded from this repository and CI. Local release results and CI/deployment evidence are recorded separately after completion.

Physical Android/tablet hardware was not used; viewport checks are Chromium emulation. This implements the reference structure within the existing app rather than claiming pixel-identical imagery.

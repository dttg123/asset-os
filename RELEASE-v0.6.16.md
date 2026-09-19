# v0.6.16 — rights classification provenance

- Rights refresh now accepts changed event/instrument/product descriptions even when amount and tax are unchanged. Partial subsequent responses preserve known descriptions. No additional payment or cash posting is created.
- Detail distinguishes explicit event descriptions, instrument inference, name inference and unverified records. Recognized redemption/liquidation events also have an explicit-event basis, not an incorrect unverified label.
- Detail, AI export and pension CSV retain the raw rights code, supplied event description and classification basis.
- Live storage key and schema 20 unchanged. No salary forecast added.

## Official-source investigation

KIS domestic `period-rights` (CTRGA011R) is based on eFriend Plus screen 7344. Official sample documents `rght_type_cd` but provides no code-to-meaning mapping. Its response fields include allocated cash, fractional-share proceeds and redemption principal. Therefore code 32 has not been assumed to mean dividend or ETF distribution.

Sources inspected 2026-09-19:
- https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/period_rights/period_rights.py
- https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/period_rights/chk_period_rights.py
- https://apiportal.koreainvestment.com/apiservice-apiservice

Limitation: the existing deployed Edge Function returns code/name/amount/tax/dates, not an event description. This release improves handling when descriptions are supplied and makes current inference visible; it does not establish an official code map or deploy a new broker server. Existing name-based inference remains provisional.

## Product comparison

- M-STOCK official overview: consolidated asset/pension access and contextual actions. Keep the existing four main areas; do not add news/community/trading features.
- Fidelity retirement planning: contribution and future monthly-income tools. Existing contribution and future-pension views cover the core need. Optional retirement spending comparison can be considered later only with user-entered assumptions, never an invented wage.
- Tiller template gallery: transaction, spending, debt and reporting continuity. Keep CSV/backup and strengthen traceability rather than duplicate reporting cards.

Sources:
- https://securities.miraeasset.com/imf/200/imf201.do
- https://www.fidelity.com/retirement/retirement-planning
- https://tiller.com/templates/

QA scope: isolated QA data only. Read-only navigation, settings, theme toggle, analysis preview and transaction detail. Real broker authentication, financial account actions and external AI sharing are not claimed as tested in this review.

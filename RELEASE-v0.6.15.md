# v0.6.15 — income and history consistency

- Pending income schedules are not forecast. Actual posted income and completed income records remain intact.
- Home funding plan includes posted expenditure/contributions and pending outflows only.
- Pension history and CSV share one read model, including broker orders/rights, historical income, and archive records. No view records are inserted into cash ledgers.
- Historical monthly dividend totals retain their unitemized remainder when detailed dividends/distributions exist. Interest is not subtracted from a dividend monthly total. Original archive amounts remain available in detail and CSV.
- Matching broker/manual income requires account, product code, date, income category, net amount and tax; matching is one-to-one and source data is preserved.
- Missing historical principal displays “계산 불가”.
- Explicit rights event descriptions take precedence over ETF name inference. Existing records without event metadata still use name inference and disclose this in detail; rights code meanings have not been assumed.
- Other consumption opens only the categories outside the top five. Retirement-boundary guidance and QA header overlap corrected.
- Backup advanced actions and history explanations are folded.

Validation: 63 automated tests, including 35-year isolated data, backup compatibility and dedicated monetary regression cases. Live storage keys and schema 20 unchanged.

Scope limits: existing broker payloads may lack event descriptions; product-name classification is not confirmation of every corporate action. Monthly archive reconciliation is an aggregate comparison, not a reconstructed individual payment history.

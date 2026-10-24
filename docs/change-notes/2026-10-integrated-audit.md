# Integrated audit — v0.7.12

The overview now shows only the selected month's consumption. Period analysis lives in Spending: daily bars for a month, monthly bars for a quarter/half/year, and yearly history. Selecting a bar updates its inline readout without rebuilding the list or changing its totals. View selections survive reload without a financial commit.

Insurance payments from the policy and schedule share the same monthly occurrence. Existing payments from either path block a second payment, including older policy-linked records. Payment dates remain actual dates, while the schedule link retains the planned occurrence. Contract/coverage/payment dates are validated before saving.

Items are grouped by category and name. Category identity follows item details, period changes, chart drilldowns, and classification edits. Renamed item/category labels are displayed and searchable in the ledger without overwriting source records. Missing category filters reset when changing periods.

Transactions have category groups and filters. Schedules have income, card, insurance, loan, saving and living-cost groups; income is separate from remaining payment totals. Group expansion updates inline so completed-history disclosures stay open. The redundant schedule month control was removed.

The card hub shows selected-month confirmed bills, paid amounts, unpaid amounts and separate estimates, followed by card/issuer summaries. Purchase details are expandable and completed purchases remain accessible in history. Fully paid cards retain current-month issuer totals. Card payment components distinguish principal, interest and points.

QA adds browser regressions for both insurance entry orders and ZIP/reload, cross-category same-name edits, renamed search, stale filters, period axes, chart geometry and selection reload, issuer bill/payment/complete states, schedule income grouping, and invalid insurance dates. Existing financial source-preservation, refund-dependency and lifecycle checks remain enabled.

The defects escaped because tests covered isolated paths and horizontal overflow while encoding the old overview chart as expected behavior. The regression expectations now follow the overview/analysis split and cross-path identities.

A delayed post-save schedule sheet now cancels if the user opens/closes another sheet or changes route. This prevents the delayed callback from replacing newly opened input. Initial chart selection prefers an in-range anchor or recent non-zero activity, and daily axes fit the phone width.

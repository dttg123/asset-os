# Spending graph, taxonomy and navigation (v0.7.8)

## Findings and changes

- The integrated overview retained an older six-column chart that truncated every amount. Item charts used a shared handler that navigated to overall spending. All active consumption charts now share a selection component: axes show periods only; a stable panel below shows the exact selected amount; a separate button opens transactions. Item charts keep their item context. Chart selection does not persist or change the globally selected month.
- The overview duplicated the home net financial assets card. Remove this duplicate and its orphan note/guard, prioritize monthly cash flow, label operatingCashDelta as 현금 증감 rather than an available cash balance, and retain home assets and existing detail functions.
- The category picker unioned all ledger categories, including legacy transaction and policy names. Its registry now contains defaults plus explicitly registered categories and aliases. Search is inline and keyboard accessible; options are in a bounded scroll area. Legacy records are not removed.
- Display classification maps insurance schedule links and unregistered labels containing 보험 to 보험, and the exact legacy 어머니용돈 label to 용돈·선물. Explicit per-transaction overrides win. Item names remain separate. This is a display projection, not a financial migration.
- Lists sort by date, group date headings, show ten rows initially and twenty additional rows per action. Matching names/categories no longer repeat. Recent previews sort by date before selecting the latest three.
- Zero bars have zero height; negative values retain their sign in accessible labels and readouts. Full amounts wrap rather than truncate. The source amount and inclusion rules remain unchanged.

## Verification

Synthetic domain tests cover picker pollution, explicit custom categories/rename, original source equality, independent duplicate records, insurance grouping and linked refunds. Browser tests cover inline selection, unchanged global month, item-scoped transactions, negative exact amounts, date pagination, category search, 320/412/768px, both themes, and enlarged chart text. Existing financial and ZIP/reload suites remain enabled.

A separate private QA copy of an existing full source snapshot is used for actual record display and preservation checks with external/cloud requests blocked. No operating database write is needed. Private records and screenshots stay outside the repository and CI. Hardware-specific certification is not claimed.

Final visual review also checks that expanding the category picker does not stretch the adjacent date input. Form grid items align at the top.

## Keyboard follow-up (v0.7.9)

A final isolated QA reproduction with all purchase fields valid found that Enter in category search could implicitly submit the purchase form. Prevent this search key's submission and focus the first matching category instead. IME composition events remain with the input. The browser regression fills a valid purchase before pressing Enter and checks exact financial collection equality and that the input sheet stays open. Operating data was never used for the reproduction.

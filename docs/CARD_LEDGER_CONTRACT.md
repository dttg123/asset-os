# Card management candidate — steps 1–3

Release candidate v0.7.6. The user has authorized validated operating reflection and deployment; status and evidence are recorded separately.
Operating state is never rewritten by this branch. With explicit user authorization, a private copy and statement-derived records are exercised in isolated local QA. Repository fixtures and CI contain synthetic data only.

## Preservation boundary

- Baseline: `dc08bb6fc2777a8e901e4ae238d6b53849061699`, main v0.7.5.
- The user explicitly authorized full read-only financial export after an initial automatic-review rejection. A complete operating snapshot and app-restorable original-schema ZIP were saved privately, outside Git. Source gzip, byte length and SHA-256, exact original ZIP data, candidate validation and normalized financial restore/rebackup equality all passed. A post-export metadata check confirmed the same operating revision/checksum. No operating writes were performed. The Git baseline copy remains separate from this financial backup.
- Preserve the verified backup before importing real records. Verification uses an isolated in-memory context without cloud integration; the operating state is never replaced. Backups are private deliverables, not application fixtures.
- Schema 22 → 23 is an identity migration. It does not manufacture, remove, deduplicate, or reclassify legacy transactions. Schemas 4–22 remain readable; future schemas remain rejected.
- Schema 23 distinguishes new card records from versions that cannot interpret separate billing and payment metadata. It must not be deployed alongside old writers without the normal version/update checks.
- QA uses `?qa=1`, its own local database/storage key, and the existing cloud-write block. Real card screenshots and amounts are not included in the repository or tests.

## Three linked records

`financeSchedules.items[].cardPlan.ledgerVersion === 2` identifies a new card purchase. Older card plans retain their existing calculation and completion behavior.

1. Purchase: gross amount, purchase discount, net purchase amount, purchase date, first billing date, card ID, category, item name, merchant, installment count, annual rate, and explicit interest-bearing installment numbers.
2. Bills: immutable IDs; issuer due date and observation date; principal, interest, principal discount and interest discount. Paid bills cannot be silently rewritten. Actual bills override estimates.
3. Payments: immutable IDs; bill ID or full-payoff mode; actual payment date; principal, interest, point allocations, actual cash and linked financial posting IDs.

Card accounts are settings records with a stable ID, issuer, display name, payment day, optional last four digits and archive status. They contain no bank account, full card number, CVC, or authentication credential. Editing a card's payment day does not change existing due dates.

## Money rules

- Purchases post consumption once and create card principal debt. A purchase discount reduces both amounts at purchase.
- Equal principal estimates use integer division; the final installment receives the remainder. Interest calculations are estimates and never replace issuer-confirmed amounts.
- Partial interest waiver terms use explicit interest-bearing installment numbers; legacy “first N installments free” plans are still read without reinterpretation.
- A confirmed principal billing discount posts a debt reduction and matching noncash refund linked to the original consumption. An interest discount changes billed interest, not purchase consumption.
- Payments post cash principal/interest separately from noncash point principal/interest. Each component must exactly match the confirmed bill after discounts. Points never reduce the cash account.
- Prepaying a bill settles only that bill. Full payoff requires the exact remaining principal and confirmed interest; it settles the remaining principal and links outstanding bills to the payoff event. Actual prepayment fees, if present, are separately recorded expenses.
- Refunds explicitly split purchase refunds into cash, returned points and unpaid-principal reduction. Cash and point refunds cannot exceed recorded principal payments of the corresponding funding type. No refund destination is guessed.
- Actual paid-interest refunds are separately linked to interest postings. They restore cash or points without subtracting purchase consumption a second time.
- Modifications cannot make any historical asset/debt balance negative. Money is checked as safe, nonnegative integer won; combined bill/payment amounts are checked too.
- The last dependent payment/refund must be reversed first. An unpaid bill may be corrected or removed, including its linked discount. A purchase may be edited only before bills, payments and refunds have been recorded.
- Same date, amount and merchant are never treated as a unique key. Each purchase, bill and payment has its own ID.
- Multi-record financial operations use one persistence commit and restore the previous integrated/schedule collections if validation or storage fails. Newly written records are canonical at creation, so restore does not add missing bookkeeping fields later.
- Restore/startup validates card-account, purchase, bill, payment and posting references before normalization. Malformed evidence is rejected rather than discarded.

## UI and analysis

- Navigation remains Home / ISA / Personal Pension / Integrated. Settings have four groups: Assets & connections, Financial management, Investments & pensions, App & data.
- All original profile actions remain reachable inside those groups. New card purchases are entered from Integrated → All; the calendar hub does not repeat the purchase-entry action.
- Consumption analysis supports months and years, category/item views, item detail with trend and original transaction links, TOP 5 by amount, existing optional living budget and fixed/variable split.
- Category rename/removal maps displayed classifications while preserving original financial rows. Removal requires a replacement classification. Unknown legacy classifications are retained.
- Refunds follow the original purchase's item identity and category. Negative net categories are listed separately from the positive-only donut denominator.
- The existing summary still distinguishes total spending and actual cash flow. Principal repayments are excluded from purchase consumption.

## Remaining phases

Samsung October records and November/December continuation, plus KB November unpaid statements, have been exercised in a private QA copy using production engine functions. No personal records or identifying amounts are in Git fixtures. Paid history is a balance observation without fabricated cash funding. Unpaid-only history uses current billed principal plus post-bill remaining principal as the opening debt; past reductions are not fabricated payments. Purchase discounts are preserved once. Confirmed due/statement days are stored separately.

The server rejects schema downgrades (including 23→22) before revision publication, while preserving conflict checks, idempotent retries, ownership enforcement and retained previous generations. Database tests exercise the staged downgrade with a correct expected revision.

Private QA validates exact original financial collections, no cash changes, independent equal purchases, idempotent import, ZIP/reload, failure rollback, mobile/tablet emulation and disposable future payments followed by restoration. Operating reflection requires a fresh source comparison, preserved pre-change snapshot, application validation and an atomic revision/checksum guarded save. Physical-device and bank API certification are not claimed.

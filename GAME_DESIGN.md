# Project: Financial Freedom (Hackathon GDD)

## Project Overview

**Financial Freedom** is a single-player game about zero-based budgeting and financial literacy. Board-style navigation (**Game Map**) combines **The Box** (budgeting) with **scenario tiles** that stress-test your plan, plus **phase-specific action games** tied to whether you are fighting debt or building wealth.

---

## Game Phases (High Level)

The experience is **not** one mini-game forever — it is **staged progression**:


| Phase               | Map                             | Action game when this phase is active                                        |
| ------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| **Debt phase**      | Game Map (Island Run prototype) | **DebtRunner** — you are in high-interest debt; this is the debt-stage game. |
| **Investing phase** | Same map idea, different stakes | **Investing Birds** — after you clear toxic debt, progression moves here.    |


**Falling back to debt:** If you **cannot pay for basic necessities** (relevant categories exhausted) and/or **Emergency Fund** cannot cover shocks, you **take on high-interest debt** again. That **drops you back to the debt phase** and the **DebtRunner** loop until you recover.

**Liquidation on debt regression:** When you fall back into the debt phase, your **Investments are liquidated 100%** (sold off — accumulated match dollars included). Proceeds are applied in this order (Year Controller, future):

1. Pay down `highInterestDebtBalance` until it is $0 (or proceeds run out).
2. Any remainder is **NOT** auto-deposited anywhere. Instead it is added to **`pendingCashToAllocate`** — a forced top-up on the next Box open. The player **must re-budget that money** in zero-based fashion before they can roll again.

While in the debt phase the **Investments tab stays locked** until you clear debt again — same rule as a fresh start.

> **Future tunable (out of scope for v1):** an early-withdrawal **liquidation haircut** (e.g. 5–10% lost) for teaching realism. Skip for the hackathon; mark in code as TODO.

**Difficulty (current scope):** Easy / Medium / Hard changes **starting income only** (`[VAR_STARTING_INCOME]`). Other knobs may follow later.

---

## Win / Loss Conditions

- **Starting state:** High-interest debt; **Investments** in The Box stays locked until **high-interest debt balance** reaches **$0** (then you can allocate to investments and pursue the investing phase).
- **Win (Financial Freedom):** Reach the designer-set `**[VAR_WIN_GOAL]`** for invested capital / FI. *Target rule (design north star):* FI when **investments at ~4% return exceed your expenses** — exact formula is implemented and tuned by the team; the shipped goal may be a fixed number for the hackathon.
- **Invested capital & time:** A **full loop around the board = one calendar year**. Each **space** is an equal **fraction of that year**. While in the investing phase, **capital from market/returns accrues in a linear per-space way** (same increment each space **relative to that year’s roll**). Each year, the **total return for the year is randomized** — some years are better than others (not a fixed “good” amount). **On every space advance**, the UI / state **updates the money shown** for investments (and related totals) so the player sees progress tick with each step.
- **Loss:** **Bankruptcy** is **voluntary** — the player gives up. It is not a forced game-over from a single bad mini-game unless we add that later.

---

## Game Variables & State Management

Core tunables for balancing:

- `**[VAR_STARTING_INCOME]*`* — Set by difficulty (Easy / Medium / Hard).
- `**[VAR_STARTING_DEBT]`** — Initial high-interest **debt balance** (what you owe).
- `**[VAR_WIN_GOAL]`** — Invested capital / FI threshold for the **investing phase** (hackathon: set explicitly; later: derived from 4% rule vs expenses).
- `**[VAR_INFLATION_RATE]`** — **Annual inflation** applied to scenario costs / cost-of-living rows. **Each new year**, inflation is **rolled** within a band — **default range 2%–8%** — so the same scenario gets **gradually more expensive** as the campaign progresses. This pressures the player to **earn more, cut waste, or invest** to keep up. **Effect application is owned by a future Year Controller**, not the UI.
- `**[VAR_INVEST_RETURN_RANGE]`** — Yearly investment return is **randomized within a band** per asset class (e.g. bonds tight band, crypto wide band). The chosen number is then **applied linearly per space** during that year (see Win / Loss).
- `**[VAR_EMPLOYER_MATCH_RATE]`** — Match rate applied to the **Employer Match** category (e.g. 50% match, capped at some % of salary). **The Employer Match category is a real budget row** — your contribution **deducts from salary** like any other category (counts toward zero-based). Later in the year, the **match dollars** (your contribution × match rate, capped) are **deposited into your Investments** by the Year Controller — that match portion is the “bonus” / free money.

---

## #1 — Budget vs Debt Balance (Authoritative)

Two different numbers must stay distinct in code and copy:

1. `**highInterestDebtBalance` (running balance)**
  The **actual amount owed** on high-interest debt. When this hits **$0**, Investments unlock and you can leave the **debt phase** for the **investing phase**.
2. `**boxAllocations.highInterestDebt` (The Box category)**
  Dollars from **this year’s salary** you assigned to **debt payoff** for the year (zero-based plan). During the map, **scenarios spend from category pools** (including this one) before they touch other categories, depending on the event.

**How they connect:**

- **Planned payoff:** Money sitting in the **High-Interest Debt** category is the pool meant to **pay down** the running balance when applied.
- **Map / scenarios:** Costs and choices **drain category balances** (see Interactive Scenarios). Paying debt from cash flow should **reduce `highInterestDebtBalance`** when money leaves that category for that purpose (implementation: tie ledger events to both pool and balance).
- **Forced debt:** If a scenario **requires payment** and **no category** (including Emergency Fund) can cover it, the player **borrows** — `**highInterestDebtBalance` increases** — and you may **regress to the debt phase** / DebtRunner per phase rules above.

**Leftover “High-Interest Debt” row (plain English):** At year-end, you may still have dollars left in the **High-Interest Debt** *category* (money you budgeted for payoff but didn’t spend because no scenario pulled from it). **Design rule:** when you **complete a full loop**, **that leftover amount automatically reduces `highInterestDebtBalance`** (capped so you never go below $0). Mid-loop, only **scenario-driven** payments move money from the category to the balance. Keep this **deterministic and logged** for balancing.

---

## The Core Game Loop (Per Year)

One **full loop** of the **Game Map** = **1 year**. Movement **per space** = **a slice of that year** (used for accrual, pacing, and narrative).

**Default** sequence each year:

1. **Payday** — Receive annual salary (`[VAR_STARTING_INCOME]`).
2. **The Box (required each loop)** — Player **must** open The Box **at least once per full loop** and submit a **valid zero-based budget** (all nine rows filled / consistent with rules) **before** they can continue the map for that year. You need real numbers in the sheet for the year to simulate.
3. **The Grind (Game Map)** — Move along the board; each landing is a **scenario** that tests the budget; **per-space** updates for investment $ when in investing phase (see Win / Loss).
4. **Phase action game (after a full loop only)** — **DebtRunner** (debt phase) or **Investing Birds** (investing phase) runs **once**, **only after you finish a complete circuit** of the map for that year — not when you first dip into debt mid-loop. Parameters come from the **modifier pipeline** and **JSON/session-style config** passed into the game (see below).

---

## "The Box" (The Budgeting Phase)

The Box is the **core budgeting UI**. **Each time you complete a full loop and start a new year, you are required to open The Box at least once** and **confirm** a valid **zero-based** allocation before you can roll for the new year on the map.

**Zero-based rule (strict):** **Every dollar of available cash must land in a category** — `total(allocations) == annualSalary + pendingCashToAllocate`. Not under, not over. There is **no “unallocated cash”** — if you don’t want to spend it, send it to **Savings** or **Investments**. The Confirm button is gated by this.

**`pendingCashToAllocate`** is a small `playerData` slot used for one-shot windfalls that must be re-budgeted before the next year:

- **Liquidation leftover** after a debt regression (see liquidation rule above).
- **Bonus / windfall** scenarios (future) that grant cash outside Payday.

When the player Confirms a budget, this slot is **drained to 0** as part of submit.

### Tabbed layout (browser-style)

The Box uses **tabs** (think Chrome tabs). Two tabs ship in v1:


| Tab                                  | When unlocked                                  | Contents                                                                                                                |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Essentials & Cash Flow** (default) | Always                                         | Cost-of-living + cash-flow categories below.                                                                            |
| **Investments**                      | **Locked** until `highInterestDebtBalance ≤ 0` | Investment subcategories below. Until unlocked, the tab shows the lock + reason; clicking it does not allow allocation. |


Both tabs share the **bottom “Allocated / Salary” strip** and the single **Confirm budget** button — moving between tabs never resets numbers.

### Tab 1 — Essentials & Cash Flow

1. **Rent**
2. **Food**
3. **Transportation**
4. **Medical**
5. **Personal**
6. **Misc / Fun** *(burnout buffer)*
7. **Emergency Fund** *(short-term defense vs scenarios)*
8. **Savings** *(general / long-term cash savings — separate from Emergency Fund and from Investments)*
9. **High-Interest Debt** *(payoff this year — see #1)*
10. **Employer Match** *(your 401(k)-style contribution — deducts from salary; bonus match arrives in Investments later — see rules below)*

### Tab 2 — Investments *(locked until debt = $0)*

Investment subcategories mirror **Investing Birds**’ asset classes (with CDs added). Exactly five rows:

1. **Index Funds** *(ETFs / broad market — Investing Birds “ETFs”)*
2. **Individual Stocks** *(Investing Birds “Stocks”)*
3. **Bonds** *(Investing Birds “Bonds”)*
4. **CDs** *(Certificates of Deposit — low-yield, low-risk)*
5. **Crypto** *(Investing Birds “Crypto”)*

**Aggregate field:** the legacy single “Investments” number = **sum** of these five subcategories. Downstream systems that already read `allocations.investments` keep working.

### Employer Match — how the rule works (Essentials tab)

- The **Employer Match** row is an **allocatable budget input** on the **Essentials** tab and is **always available** (even while in debt — it represents your paycheck-deducted retirement contribution).
- Whatever you put there **deducts from salary** like any other row, so it **counts toward zero-based** (`total(allocations) == annualSalary`).
- Later in the year, the **Year Controller (future)** computes the **bonus match** = `contribution × [VAR_EMPLOYER_MATCH_RATE]`, **capped at** `capPctSalary × annualSalary`.
- The bonus is then **deposited into Investments later** — visualized as `+$ match` in the UI; that match portion is the **free money on top** of your own contribution.
- Until the Year Controller runs, the UI shows the **projected** match (info-only chip), so the player sees the future bonus while still budgeting today.
- **Locked-tab behavior:** even though the Investments **tab** is locked while in debt, the **bonus match deposit** is held in the same Investments bucket; when the player exits debt, the bucket is unlocked with whatever match has accrued.

> **Progression lock:** the **Investments tab** (the five asset-class rows) is gated by `highInterestDebtBalance ≤ 0`. **Employer Match** is **not** gated — it lives on Essentials.

### Inflation across years (owned by the Year Controller)

At the **start of each new year (Payday)**, the **Year Controller (future)** rolls `**[VAR_INFLATION_RATE]`** within the **2%–8%** band. From then on, **scenario costs** and **cost-of-living suggestions** for that year are **scaled by `(1 + inflation)`** vs the prior year. The Box only **displays** the current-year inflation % (header chip) — it does not apply effects itself.

### Savings — player-choice only

**Savings is never auto-drained.** Scenarios cannot pull from Savings; only an **explicit player choice** (a scenario option that says “use Savings”) can move money out of it. Treat Savings like a long-horizon vault distinct from the **Emergency Fund** (which scenarios can spend during shocks). **Savings is NOT exposed to the runner profile** — DebtRunner's modifier inputs do not read it.

---

## Interactive Scenarios (Game Map)

- **Consequence-driven:** Choices change **category pools** from The Box.  
- **Category drain:** e.g. car repair pulls from Transportation and/or Emergency Fund.  
- **Forced debt:** If required payment cannot be covered from categories (including Emergency Fund), add to `**highInterestDebtBalance`** and apply **phase regression** rules above.

---

## The Modifier Pipeline

1. Player funds categories in The Box.
2. Scenarios **drain** pools during the map.
3. At **end of loop**, evaluate **remaining** balances per category.
4. Feed **structured modifiers** into the active phase game (DebtRunner today: **budget profile + resolved session config** / JSON-shaped data — see `budgetEffectResolver` / `runner.profile` in code).

`**[VAR_POSITIVE_MODIFIER]` / `[VAR_NEGATIVE_MODIFIER]`** — Global **ease / hardship** knobs on top of per-run JSON (e.g. next year’s income bump vs penalty). Pair with **mini-game win/loss** (and optionally score tiers later).

---

## Map size (terminology)

**“Map size”** means **how many spaces / tiles one full loop** of the Game Map has (i.e. how many steps = one year). That **count is still a design/balance choice** (not locked in the GDD) — pick **N** so one year feels good in playtests; implementation can treat **N** as a constant or data-driven value.

---

## Implementation Notes (Code Alignment)

- **Game Map** = Island Run shell in repo; **Debt phase game** = DebtRunner; **Investing phase game** = Investing Birds.
- **Bankruptcy** = explicit player opt-out only.
- **Cross-module contract:** navigation and state via `**@/core`** (events + `playerData`), not UI ↔ game imports (`AGENTS.md`).
- **Year counter:** `playerData.currentYear` (1-indexed integer) tracks which year the player is on. The Year Controller (future) increments it at Payday; UI may show it in the HUD / Box header. Inflation history and modifier logs can be keyed by year.
- **Pending cash slot:** `playerData.pendingCashToAllocate` (number, default 0) holds liquidation leftover and windfalls between Box submits. Strict zero-based uses `salary + pendingCash`; submit clears it.
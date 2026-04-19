# Project: Financial Freedom (Hackathon GDD)

## Project Overview

**Financial Freedom** is a single-player, turn-based educational game designed to teach zero-based budgeting and financial literacy. Inspired by the board navigation of Mario Party, the game forces players to manage their finances, survive life events, and escape the cycle of debt to achieve financial independence. 

The game combines strategic resource allocation ("The Box") with dynamic, action-oriented mini-games and scenarios that are directly modified by the player's budgeting choices.

---

## Win / Loss Conditions

- **Difficulty:** Player selects Easy, Medium, or Hard at the start, which strictly determines their starting income. 
- **Starting State:** The player always starts in **High-Interest Debt**.
- **Win Condition:** Pay off all high-interest debt, unlock the "Investments" category, and hit a specific overarching investment goal (Financial Freedom).
- **Loss Condition:** The player can voluntarily choose **Bankruptcy** (give up) if the debt spiral becomes unmanageable, acting as the primary failure state.

---

## Game Variables & State Management

To allow for easy balancing and testing during the hackathon, core economic values are stored as adjustable variables. 

- `**[VAR_STARTING_INCOME]`**: Determined by Easy/Medium/Hard difficulty setting.
- `**[VAR_STARTING_DEBT]`**: The initial high-interest debt balance assigned at the start of the game.
- `**[VAR_WIN_GOAL]`**: The total invested capital required to achieve Financial Freedom.

---

## The Core Game Loop

One full loop around the physical map represents **1 Year** of the player's life. The game loop operates in four distinct phases:

1. **Payday (Start of Loop):** The player receives their annual salary `[VAR_STARTING_INCOME]`.
2. **The Box (Budgeting):** The player allocates their entire salary across 9 specific categories to survive the upcoming year (Zero-Based Budgeting).
3. **The Grind (The Map):** The player rolls a virtual dice to move along the board. Every space landed on is a **Scenario** that tests their budget.
4. **The Year-End Review (Mini-Game):** At the end of the board loop, the player plays an action mini-game modified by how well their budget survived the year.

---

## "The Box" (The Budgeting Phase)

"The Box" is the core UI menu. Players *must* allocate their funds here before they can roll on the map. 

There are **9 Budget Categories**:

1. **Emergency Fund** (The primary defense against bad scenarios)
2. **Rent**
3. **Food**
4. **Transportation**
5. **Misc / Fun**
6. **High-Interest Debt**
7. **Investments** (LOCKED initially)
8. **Medical**
9. **Personal**

> **Progression Lock (Dev Note):** The "Investments" category is strictly locked at the start of the game. It can only be unlocked once the "High-Interest Debt" balance reaches $0. This teaches players to prioritize toxic debt over investing.

---

## Interactive Scenarios (The Map)

The map consists entirely of Scenario tiles. Landing on a tile triggers an interactive life event where the player must make a financial or lifestyle choice.

- **Consequence-Driven:** Choices directly impact the money previously allocated in "The Box."
- **Category Drain:** If a player chooses to fix a broken car, the cost is deducted from the "Transportation" or "Emergency Fund" category. 
- **Forced Debt Trigger:** If a scenario demands a payment and the relevant budget categories (including the Emergency Fund) are empty, the player is *forced* to take on more High-Interest Debt to progress.

---

## The Modifier Pipeline

The difficulty of the end-of-year mini-game is directly linked to the player's budgeting success throughout the map phase. 

1. **Initial State:** The player funds the 9 categories in The Box.
2. **The Drain:** Map scenarios deplete these categories based on player choices and RNG.
3. **Final State Calculation:** At the end of the board loop, the game evaluates the remaining balance in each of the 9 categories.
4. **Modifier Injection:** Empty or underfunded categories trigger negative modifiers for the mini-game.
  - *Example:* If "Food" is empty, player speed decreases. 
    - *Example:* If "Misc/Fun" is empty, enemy count doubles to represent burnout.

---

## The Year-End Mini-Game & Outcomes

After completing one full loop around the board, the player enters the mini-game. This is an arcade-style action game (e.g., Pac-Man, platformer) that visually represents the physical and mental toll of "living out the year."

**Dynamic Difficulty:** The game's parameters (speed, hazards, enemies, time limits) are dictated entirely by the Modifier Pipeline.

**Outcomes & Variable Modification:**
Depending on the player's score or survival state in the mini-game, a modifier is applied to one of the core game variables for the upcoming year:

- **The Win State (Good Modification):** If the player wins or achieves a high score, the game applies `[VAR_POSITIVE_MODIFIER]`. 
  - *Implementation:* E.g., Increases `[VAR_STARTING_INCOME]` by 10% (a raise), or adds lump-sum cash to the next budgeting phase.
- **The Loss State (Bad Modification):** If the player fails or dies, the game applies `[VAR_NEGATIVE_MODIFIER]`.
  - *Implementation:* E.g., Multiplies `[VAR_STARTING_DEBT]` by a penalty interest rate, or decreases `[VAR_STARTING_INCOME]` for the next year (demotion).

> **Dev Note:** The exact target variable modified by the Win/Loss states can be configured in the global settings. The core logic simply needs to pass a true/false (win/loss) state from the mini-game scene back to the main map/budgeting controller.
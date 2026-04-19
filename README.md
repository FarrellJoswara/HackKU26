# 🏝️ Island Adventure

> **Financial freedom should be a journey you can actually survive, not a lesson you tune out.**

Island Adventure is a stylized 3D financial literacy game that turns life after graduation into an interactive survival journey. Instead of learning through lectures, spreadsheets, or static calculators, players learn through consequences: budgeting decisions, debt, savings, risk, and long-term planning all shape the path ahead.

Built for **HackKU**, the project combines a tropical party-game-inspired world with decision-driven gameplay to make financial planning feel memorable, approachable, and actually fun.

---

## ✨ Inspiration

We wanted to make financial literacy feel like a **real game** instead of a lecture or spreadsheet tutorial.

A lot of people graduate into a world full of confusing money decisions such as rent, debt, insurance, emergencies, lifestyle choices, and long-term savings, but most tools that try to teach this are boring or overwhelming. We were inspired by chaotic survival and journey-based games, where every decision matters and short-term comfort can hurt you later.

That led us to the idea of turning financial freedom into an adventure: a stylized island journey where players survive adulthood by making smart choices, adapting to unexpected events, and learning through consequences.

---

## 🎮 What It Does

Island Adventure transforms life after graduation into an interactive survival experience.

Players move through a playful island world while making decisions around:

- budgeting
- debt
- savings
- risk
- long-term planning

A player might choose between spending more now for comfort or saving for future emergencies and the game later tests those decisions through random events and challenges.

Our goal was to make financial planning feel:

- engaging
- memorable
- approachable
- game-first, while still teaching real concepts like emergency funds, spending discipline, and resilience

---

## 🧱 How We Built It

We built Island Adventure as a stylized 3D game experience with a **beachy, party-game-inspired world** to match the theme of HackKU.

The project is split into two major layers:

### 1. Background / World Layer
This handles the tropical island environment:
- sand
- water
- rocks
- docks
- palm trees
- decorative props and buildings

### 2. Gameplay Layer
This handles the actual interactive systems:
- walkable spaces
- player movement
- events
- progression
- game flow

This separation gave us a strong foundation to build something that looks polished while staying flexible for future expansion.

---

## 🛠️ Tech Stack

We built Island Adventure with:

- **React**
- **TypeScript**
- **Vite**
- **Tailwind CSS**
- **Zustand**
- **Three.js**
- **React Three Fiber**
- **@react-three/drei**
- **Howler.js**
- **Gemini API**

We chose this stack because we needed something that could support both:
- **game-like 3D interaction**
- **clean web-based UI**

while still being fast enough to build and iterate on during a hackathon.


## 📚 What We Learned (New Skills!)

### Nischay
I learned how to use React Three Fiber and Three.js to build the island-based 3D world and create the game’s visual atmosphere. This was challenging because I had to go beyond just getting objects on the screen and really learn how to structure a 3D scene, place assets intentionally, and make the environment feel polished and immersive for actual 3D gameplay.

### Emma
I learned how to structure shared game state and progression systems so player decisions, resources, and outcomes could flow cleanly across the experience. This made me think much more carefully about how everything in the game connects, since even small choices had to carry through events, minigames, and later consequences without breaking the overall experience.

### Farrell
I learned how to think about blockchain integration in a much more practical way because even a simple idea like posting the game results to Solana allows you to have proof of ownership of your progress in building your financial literacy. I also got to learn how a blockchain ecosystem like Solana could support progression, persistence, or ownership without feeling forced. It was also a learning experience because I got to figure out where Web3 ideas actually add value to a game instead of just being added on.

### Sneha
I learned how to handle 3D asset integration and scene composition, from bringing in models and textures to arranging props in a way that made the world feel cohesive and readable. This was challenging because it was not just about dropping assets into the scene, it was also about learning how composition, spacing, and visual balance affect the environment and if the in game physics actually make sense for something that looks as simple as angry birds.
---

## 🚀 Setup

## 🚀 Setup Instructions

Follow these steps to run **Island Adventure** locally.

```bash
1. Clone the repository
git clone <your-repo-url>

2. Move into the project folder
cd <your-project-folder>

3. Open the project in your code editor
For example, in VS Code:
code .

4. Install dependencies using the project lockfile
This project includes a package-lock.json, so install dependencies with:

npm ci

Using npm ci ensures the exact dependency versions defined in our lockfile are installed, which makes setup more consistent across machines.

5. Start the development server
npm run dev

6. Open the app in your browser

After the dev server starts, open the local URL shown in your terminal, usually:
http://localhost:5173

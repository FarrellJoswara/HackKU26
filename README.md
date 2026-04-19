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

---

## 🚀 Setup

### Prerequisites

Make sure you have:

- **Node.js 18+**
- **npm 9+**

### Install dependencies

This project includes a lockfile, so the cleanest way to install using the project’s dependency definitions is:

```bash
npm ci

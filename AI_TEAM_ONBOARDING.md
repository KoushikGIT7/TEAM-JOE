# 🚀 JOE Cafeteria Automation: AI Prompt Engineer Guide

Welcome to the team! You are taking over a highly optimized, production-ready React codebase for the **Zero-Wait JOE Cafeteria System**. 

This guide provides exactly what you need to safely upgrade and extend the system using AI programming assistants, without breaking the foundational architecture or the core logic.

---

## 🏗️ 1. Project Overview: What We've Built So Far

We have engineered a robust, real-time web application to automate cafeteria workflows smoothly and seamlessly:

- **Technology Stack:** React 18 (TypeScript), Vite, TailwindCSS for UI, and Firebase (Authentication + Firestore SDK v12).
- **Core Engine Operations:**
  - **The Cook Console:** Employs dynamic batching. Items are pooled and prepared simultaneously without duplicated UI actions.
  - **The Server Portal:** Drives a real-time QR scanning pipeline.
  - **Optimized Data Schema:** We recently refactored to an optimal nested schema: `orders/{orderId}/items/{itemId}`. This eradicated Firestore quotas, read-after-write recursion bugs, and UI desync.
- **Visual State:** Everything relies on a premium, clean layout with instant transition mechanisms.

---

## 🛡️ 2. Core Safety Protocols (How NOT to Break the Base)

As a prompt engineer, you command immense power with your AI tools. To protect the project's stability, follow these cardinal rules:

1. **Protect the Database Schema:** Never ask the AI to change the `orders` schema or the `items` subcollections. They are precisely mapped to prevent Firebase quota limits. 
2. **Protect Security Rules:** Leave `firestore.rules` and `firestore.indexes.json` exactly as they are unless a senior dev requests it.
3. **Additive over Destructive:** To add new features (e.g., "Add an Analytics table"), instruct the AI to create **new** component files in `/components` instead of radically replacing core application layout files like `App.tsx` or `index.html`.
4. **Isolate Your Requests:** Give your AI one specific task at a time. Small, atomic prompts (e.g., "Change the color of the scan button") are safe. Asking the AI to "Refactor the entire staff console" is dangerous for beginners.

---

## 🧠 3. The "Safe Initialization" Prompt

Before you begin executing tasks, **always copy and paste the prompt below** to configure your AI's context and prevent hallucinated, dangerous behavior.

### 📋 Copy-Paste This Predefined Prompt to Your AI First:

> "You are an expert AI Coding Assistant deployed on the JOE Cafeteria Automation project. 
> 
> **Context:**
> - Tech Stack: React 18 (TypeScript), Vite, TailwindCSS, Firebase v12 (Firestore).
> - Architecture Pattern: The application heavily relies on an optimized `orders/{orderId}/items/{itemId}` document subcollection strategy for real-time order syncing to prevent Firebase quotas and infinite loops.
> 
> **Your Hard Constraints for this conversation:**
> 1. DO NOT suggest altering the existing Firestore database schemas, security rules, indexes, or the transaction/batching logic unless I explicitly approve. 
> 2. DO NOT rewrite large swaths of existing codebase. Focus strictly on modular, atomic implementations. 
> 3. Provide exactly the code block required for the change—leave the rest of the file untouched.
> 4. Ensure all new UI additions utilize our strict, modern Tailwind design layout (minimal, responsive, clean).
> 
> I am now going to give you my first feature request. Please analyze it against the constraints above, ask to read any necessary context files, and provide the safest implementation path."

---

## 🗺️ 4. Key Architecture Files to Feed Your AI

When you want to upgrade a specific feature, **do not let the AI guess where the code is**. Explicitly tell it to read the following files based on your goal to ensure smooth continuation:

- **Routing or Core Layout:** Point the AI to `App.tsx` and `index.css`.
- **Backend / Firebase Setup:** Point it to `firebase.ts` and `firestore.rules`.
- **Cook & Server Consoles (The Kitchen Engine):** Tell your AI to deeply read `UnifiedKitchenConsole.tsx`. This is the holy grail file routing both the Server workspace (QR scanning) and the Cook workspace (Item batching). 
- **Types & Interfaces:** Point it to `types.ts` so the AI knows the exact shape of an `Order` or `OrderItem`.

*Example Prompt:* "Read `types.ts` and `UnifiedKitchenConsole.tsx`, then explain how the Server Workspace updates an item's status to 'served'."

---

## 🤝 5. Collaboration Strategy: The Central Repo Rule

You are a 3-person team, and you will all be deploying AI code simultaneously. I have already set up a **Central Repository** to prevent disastrous merge conflicts.

To collaborate safely without overwriting each other's work, strictly enforce these Git hygiene rules:

1. **Pull Before You Prompt:** Always run `git pull` *before* starting a new AI session. Ensure you have the latest code from your teammates so your AI doesn't write code based on an outdated codebase.
2. **The Signature Commit Rule:** When you or the AI commits code to the repo, you MUST use a descriptive signature format. Do not allow your AI to write generic commit messages like "Updated codebase". 

Your commitments must look exactly like this:
> **Commit Message Format:** `[Feature/Fix Name] - I am {Your_Name} doing this commit. {1 sentence explaining exactly what was changed}.`
> *Example:* `[Add Print Button] - I am Koushik doing this commit. Added a Print Report button to the Manager Dashboard.`

By enforcing accurate file feeding and strict commit signatures, the three of you will smoothly build upon this foundation without stepping on each other's toes. Keep it minimal and iterate incrementally. Happy coding!

# JOE — 2-Minute Demo Script
## Live Demonstration Walkthrough for VC / Jury Presentation

---

## Pre-Demo Setup Checklist

Before presenting:
- [ ] Open https://joecafebrand.netlify.app on projector browser (Desktop Chrome)
- [ ] Have a second device (phone) logged in as a student
- [ ] Login credentials ready:
  - Student: Google Sign-In (any Google account)
  - Cashier: cashier@joecafe.com / [password]
  - Server: server@joecafe.com / [password]
  - Cook: cook@joecafe.com / [password]
- [ ] QR camera working on server device
- [ ] Restaurant background music or silence — no distractions

---

## The Script (2 Minutes Exactly)

---

### [0:00 – 0:15] — THE HOOK (15 seconds)

> *"Every day in Indian college cafeterias, students waste 20 minutes standing in a queue for a 5-minute meal. That's 200 person-hours lost every single day in a 600-student college. JOE eliminates that queue entirely. Let me show you — in real time."*

**[Action]**: Show the Welcome screen on projector.

---

### [0:15 – 0:35] — STUDENT PLACES ORDER (20 seconds)

> *"A student opens JOE on their phone — no app download. Just a web link. They can see the full live menu with stock levels. Tap to add items. Real-time inventory. No surprises at the counter."*

**[Action on phone]**:
1. Tap "Continue with Google" → lands on HomeView
2. Show Breakfast category — Masala Dosa + Filter Coffee
3. Add both to cart
4. Tap "Process Order"

> *"Payment options: UPI or Cash. Let's say Cash — we'll see the cashier approve it."*

**[Action]**: Select "Pay with Cash" → Order placed.

---

### [0:35 – 0:50] — CASHIER APPROVES (15 seconds)

> *"On the cashier console — a new order just appeared. Student name, items, total. The cashier physically collects the cash and taps Approve. The student's QR code activates instantly."*

**[Action on projector browser]**: Switch to CashierView → Show the pending order → Tap **APPROVE**.

**[Action on phone]**: QR code appears on student screen instantly.

> *"The QR is cryptographically signed. A screenshot is useless. It expires in 30 minutes."*

---

### [0:50 – 1:15] — KITCHEN PIPELINE (25 seconds)

> *"Meanwhile, on the kitchen console — the cook can see a Masala Dosa has just come in. FIFO order. They tap START — clock is running — then DONE when it's ready. That single tap turns the student's live tracker to 'Food is Ready' and fires a push notification to their phone."*

**[Action on projector]**: Switch to Cook workspace → Show batch queue → Tap **START** → tap **DONE**.
**[Action on phone]**: Show push notification + status banner turning green — "🎉 Food is Ready!"

---

### [1:15 – 1:35] — SERVER SCANS QR (20 seconds)

> *"At the counter — the server opens the camera. Student shows QR. One scan."*

**[Action on projector]**: Switch to Server tab → Open scanner → Point at student QR on phone.

> *"Instantly, the server sees a full manifest — food image, name, quantity. They tap SERVE. Order closed. Student collected their food. That entire interaction took under 4 seconds."*

**[Action]**: Tap **SERVE ALL** → Order shows as CONSUMED.

---

### [1:35 – 1:50] — ADMIN DATA (15 seconds)

> *"And the admin gets this — a live dashboard. Revenue by day. Orders by payment type. Item-wise breakdown. Exportable to CSV. The cafeteria manager, for the first time ever, knows exactly what's happening in their kitchen."*

**[Action on projector]**: Briefly show Admin Dashboard → Metrics section.

---

### [1:50 – 2:00] — CLOSE (10 seconds)

> *"JOE is live. The code is written. The system works. What we need now is a pilot cafeteria and the runway to prove this at scale. That's what this grant / investment makes possible."*

---

## Backup Talking Points (Q&A)

**Q: What if the internet goes down at the cafeteria?**
> Firestore offline persistence keeps JOE functional. Orders placed offline sync when connectivity returns. The counter still has a manual fallback for cashier to check order IDs.

**Q: What about students without smartphones?**
> Cash payment kiosk mode: Cashier can manually create an order on the student's behalf. This is a built-in fallback flow.

**Q: How does JOE make money?**
> Three channels: (1) Monthly SaaS fee per cafeteria (₹3,000–8,000/month), (2) per-UPI-transaction fee routed through the institution, (3) Premium analytics tier for multi-campus management.

**Q: How long to deploy at a new college?**
> 48 hours to go live: Firebase project setup, Netlify deploy, menu data entry, staff account creation. Week 1 training. Week 2 first live orders.

**Q: Why not just use existing apps like ET or Swiggy for Business?**
> They're built for delivery logistics, not on-campus walk-in serving. They require dedicated hardware. They don't support cash payment workflows. They don't route to kitchen stations. JOE is purpose-built for this exact use case.

---

## Demo Recovery Playbook

| Problem | Recovery |
|---------|---------|
| Internet drops | Switch to recorded demo video (keep on USB) |
| Login fails | Use pre-recorded screen session backup in OBS |
| QR scan fails | Show the manifest screen directly from pre-loaded state |
| App crashes | GlobalErrorBoundary auto-reloads in 4s — narrate it as a feature ("built-in resilience") |
| Notification doesn't fire | Explain the OneSignal architecture verbally — demo on next test |

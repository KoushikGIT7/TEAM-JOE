# JOE — Pilot Testing Plan
## 90-Day College Cafeteria Rollout Blueprint

---

## Pilot Goal

Deploy JOE at **1 engineering college cafeteria** serving 400–800 students and validate:
1. ≥ 70% student adoption within 30 days
2. ≥ 80% reduction in peak-hour queue depth
3. Zero QR fraud incidents
4. Cafeteria manager can operate dashboard independently within 1 week

---

## Target Pilot Profile

| Criteria | Requirement |
|----------|-------------|
| Student count | 400–1,200 students |
| Daily cafeteria orders | 300–800/day |
| Payment mix | ≥ 50% UPI-comfortable students |
| Staff openness | At least 1 tech-comfortable cashier + server |
| Internet | Stable WiFi at counter (4G fallback acceptable) |
| Language | Tamil Nadu / Karnataka / Telangana campus preferred (bilingual UI ready) |

---

## Pre-Pilot Checklist (Week -2)

### Technical Setup
- [ ] Create Firebase project (Firestore, Auth, Functions)
- [ ] Deploy Netlify instance with college branding (logo, colors)
- [ ] Configure .env with college-specific QR secret key
- [ ] Seed Firestore menu with actual cafeteria items + prices
- [ ] Upload food images for all menu items
- [ ] Create staff accounts (1 admin, 1–2 cashiers, 1–2 servers, 1–2 cooks)
- [ ] Fire all Firestore indexes (composite indexes for orders, prepBatches)
- [ ] Configure OneSignal app ID for push notifications
- [ ] Test end-to-end flow: student order → cashier approve → cook → serve

### Operations Setup
- [ ] Brief cafeteria manager on admin dashboard (1-hour session)
- [ ] Brief cashier on cash approval flow (30 min)
- [ ] Brief cook on kitchen console (30 min)
- [ ] Brief server on QR scanning + serve flow (30 min)
- [ ] Print QR posters for counter: "Order on JOE → joecafebrand.netlify.app"
- [ ] Set up feedback WhatsApp group: admin + pilot team

---

## 3-Phase Rollout

### Phase 1: Soft Launch (Days 1–7)
**Goal**: Get first 50 students to place real orders

| Day | Action |
|-----|--------|
| Day 1 | Go live. Staff demo breakfast rush. No pressure on students. |
| Day 2 | Identify first 20–30 "early adopter" students (hostel CR reps, tech-savvy). Hand-hold them through first order. |
| Day 3 | Monday motivation: announce "Skip The Line" on college WhatsApp groups |
| Day 4–5 | Address top 3 friction points (login issues, menu confusion, payment) |
| Day 6–7 | First weekly report to cafeteria manager. Baseline metrics captured. |

**Success metric**: 50+ orders placed on JOE by Day 7.

---

### Phase 2: Growth Phase (Days 8–45)
**Goal**: Reach 70% of daily orders through JOE

| Week | Focus | Actions |
|------|-------|---------|
| Week 2 | UPI adoption push | Partner with Hostel Office to share JOE link via official student portal |
| Week 3 | Kitchen validation | Cook console stress-tested during Monday lunch rush |
| Week 4 | Push notifications | Enable FCM/OneSignal; measure "notification → pickup" response time |
| Week 5 | Cash queue reduction | Cashier begins declining walk-up cash without JOE order ID |
| Week 6 | Menu optimization | Admin uses dashboard data to identify top 10 items; adjust prep accordingly |

**Success metric**: ≥ 70% of daily orders through JOE by Day 45.

---

### Phase 3: Full Operations (Days 46–90)
**Goal**: JOE is the default. Manual system is fully retired.

| Week | Focus | Actions |
|------|-------|---------|
| Week 7 | Inventory management | Admin sets opening stock daily; low-stock alerts validated |
| Week 8 | Reporting | First monthly revenue report exported as CSV |
| Week 9 | Stress testing | Simulate 300+ orders in 2 hours (peak lunch on exam day) |
| Week 10–12 | Documentation + scale | Document learnings. Prepare template for next college. |

**Success metric**: 0 manual tokens issued in final 2 weeks. Admin operates independently.

---

## Pilot KPIs (Measured Weekly)

| KPI | Target | Measurement Method |
|-----|--------|--------------------|
| Daily active orders via JOE | ≥ 300/day by Week 4 | Firestore orders count |
| Peak queue depth | ≤ 5 people | Direct observation at counter |
| Student adoption rate | ≥ 70% by Day 30 | Unique userIds in orders / total students |
| QR fraud attempts | 0 successful | Firestore idempotency_keys + scanLogs |
| Cashier approval time | < 60 seconds | createdAt vs confirmAt delta |
| Cook batch completion time | < Avg prep time | startedAt vs finishedAt in prepBatches |
| Push notification open rate | ≥ 60% | OneSignal dashboard |
| Admin dashboard adoption | Self-service by Week 2 | Support ticket count |
| Food waste reduction | ≥ 20% | Canteen manager estimate |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Students resistant to change | Peer pressure from CR reps + "first order free" incentive |
| Staff unfamiliar with app | 30-min hands-on session + printed quick-guide |
| Internet connectivity issues | Firestore offline persistence + 4G hotspot backup |
| QR camera not working on staff phone | Fallback: manual Order ID entry for server |
| Peak-hour crash | GlobalErrorBoundary auto-reload; Firestore handles 50,000 writes/min |
| Admin quits mid-pilot | All admin actions are in Firestore; new admin inherits data immediately |
| Payment disputes | Full audit trail in Firestore + scanLogs for every transaction |

---

## Post-Pilot Decision Gate (Day 90)

### GO criteria (deploy to second college):
- ✅ ≥ 70% adoption rate achieved
- ✅ ≥ 80% queue reduction validated
- ✅ Zero successful fraud incidents
- ✅ Admin can operate independently
- ✅ At least 1 testimonial from cafeteria manager

### NO-GO (iterate and retry):
- ❌ < 40% adoption → investigate login friction or menu confusion
- ❌ Staff non-adoption → more training or UI simplification
- ❌ Technical reliability issues → fix before scale

---

## Success Story Template (Post-Pilot)

> *"Before JOE, our lunch queue would stretch to 40 people every day. Students were complaining, teachers were frustrated. With JOE, orders come in 15 minutes before the rush. Our cooks know what to make. Students get a notification and just walk up to collect. The queue is gone."*
>
> — [Cafeteria Manager Name], [College Name]

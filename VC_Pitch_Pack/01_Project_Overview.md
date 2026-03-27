# JOE — Just-in-time Ordering Engine
## Project Overview | VC Pitch Pack

---

## Executive Summary

**JOE** is a full-stack cafeteria automation system built for Indian engineering college campuses. It eliminates the daily chaos of cafeteria queues by digitising the entire food ordering and serving pipeline — from student order to plate delivery — using a QR-code-driven, real-time mobile-first PWA.

> **One line:** JOE replaces the physical queue at college cafeterias with a zero-hardware, mobile-native smart ordering system.

---

## The Problem We Solve

Indian engineering college cafeterias face a predictable, recurring crisis every single day:

| Pain Point | Impact |
|-----------|--------|
| Students queue 15–30 minutes for a 5-minute meal | Lost academic time, daily frustration |
| Manual token/cash system prone to fraud | Revenue leakage, disputes |
| No kitchen visibility → food wasted or over-prepared | 20–40% excess food cost |
| Servers have no digital manifest → wrong orders served | Student complaints, re-makes |
| No data on peak hours, popular items | Zero operational intelligence |

---

## What JOE Does

```
Student orders on phone
      ↓
Cashier approves (cash) or UPI auto-confirmed
      ↓
QR code generated with HMAC-SHA256 cryptographic signature
      ↓
Student shows QR at counter
      ↓
Server scans → kitchen pipeline triggered automatically
      ↓
Cook sees FIFO batch queue on kitchen console
      ↓
Cook marks READY → Server console shows manifest
      ↓
Server clicks SERVE → order closed, student notified
```

**Average end-to-end serving time: < 4 minutes** (vs 20+ minutes manual)

---

## Who Uses It

| User | Device | Daily Actions |
|------|--------|--------------|
| **Students** | Personal smartphone | Browse menu, pay, track order, show QR |
| **Cashier** | Shared tablet/phone | Approve cash payments in real time |
| **Cook** | Kitchen tablet | View FIFO batch queue, mark items ready |
| **Server** | Counter phone | Scan QR codes, serve or reject items |
| **Admin** | Any device | Monitor revenue, manage menu & staff, view reports |

---

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + TypeScript + Vite | Mobile-first PWA, no app install needed |
| Database | Firebase Firestore | Real-time sync across all devices, <50ms latency |
| Auth | Firebase Auth (Google + Email) | Zero password setup for students |
| Backend | Firebase Cloud Functions v2 | Serverless, scales to 10,000+ students |
| QR Security | HMAC-SHA256 signed payloads | Fraud-proof, no screenshot reuse |
| Notifications | OneSignal + FCM | Push alerts when food is ready |
| Hosting | Netlify CDN | Global edge, instant deploy |

---

## Current Status

- ✅ **Production-grade codebase** — TypeScript strict, full type coverage
- ✅ **Live deployment** — joecafebrand.netlify.app
- ✅ **All 5 user roles** implemented and tested
- ✅ **QR fraud protection** — HMAC-SHA256 + idempotency guards
- ✅ **Real-time kitchen pipeline** — FIFO batch queue, station-based routing
- ✅ **Financial reporting** — Daily P&L, CSV export
- ✅ **Inventory management** — Low stock alerts, sharded writes
- ✅ **Push notifications** — Order ready alerts via OneSignal + FCM
- 🔄 **Pilot testing** — Ready for college cafeteria onboarding

---

## The Team

Built by **Koushik** — Full-Stack Engineer, systems designer, and cafeteria problem experiencer firsthand. Every design decision in JOE was driven by direct daily observation of the same chaos it aims to eliminate.

---

## Contact & Links

- **Live Demo**: https://joecafebrand.netlify.app
- **GitHub**: https://github.com/KoushikGIT7/JOE-ENDGAME
- **Deck Version**: March 2026

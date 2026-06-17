# ⚡ QUICK REFERENCE - Backend Development Cheat Sheet

**Print this page** | **Keep it open while coding** | **One-page summary**

---

## 🎯 WHAT YOU'RE BUILDING

```
Cafeteria Order Management System
├─ Students: Browse menu → Add to cart → Pay → Get QR → Pick up order
├─ Staff: Receive orders → Prepare → Validate QR → Mark served
├─ Admin: View real-time dashboard → Track revenue → Manage menu/users
└─ Integration: Google OAuth → Razorpay payments → Real-time WebSocket
```

---

## 🗓️ IMPLEMENTATION TIMELINE

| Week | Focus | Key Deliverable | Dev Days |
|------|-------|-----------------|----------|
| 1-2 | Foundation | Auth + Database | 10 days |
| 3-4 | Core Logic | Orders + Payments | 10 days |
| 5-6 | Advanced | Real-time + Admin | 10 days |
| 7-8 | Deployment | Docker + Production | 10 days |
| **Total** | **All** | **Live in Production** | **40 days** |

---

## 📦 TECH STACK

```
├─ Runtime: Node.js 18+
├─ Framework: Express.js + TypeScript
├─ Database: PostgreSQL (primary)
├─ Cache: Redis (sessions + frequent data)
├─ API Format: REST JSON + WebSocket (Socket.io)
├─ Authentication: JWT tokens + Firebase OAuth
├─ Payment Gateway: Razorpay
├─ Real-time: Socket.io
├─ Deployment: Docker + GitHub Actions
└─ Monitoring: Sentry + Winston logs
```

---

## 📊 DATABASE SCHEMA (10 Tables)

```sql
-- Core
users
├─ id, firebase_uid, email, name, role, status
├─ role: student | cashier | server | admin
└─ status: active | inactive | suspended

menu_items
├─ id, name, price, cost_price, category
├─ category: Breakfast | Lunch | Snacks | Beverages
└─ imageUrl, description, status

-- Main Features
orders
├─ id, user_id, total_amount, tax_amount, final_amount
├─ order_status: PENDING | CONFIRMED | ACTIVE | SERVED | CANCELLED
├─ payment_status: PENDING | SUCCESS | FAILED
├─ qr_status: PENDING_GENERATION | ACTIVE | USED | EXPIRED
└─ payment_type: UPI | CARD | CASH | NET

order_items (line items)
├─ order_id, menu_item_id, quantity, unit_price
└─ served_qty (for partial serving)

payments
├─ order_id, amount, payment_method
├─ gateway_transaction_id (Razorpay)
└─ status: PENDING | SUCCESS | FAILED

qr_codes
├─ qr_token (unique), order_id, secure_hash
├─ status: ACTIVE | USED | EXPIRED
└─ expires_at (30 minutes)

-- Supporting
inventory
├─ menu_item_id, current_stock, consumed_today
├─ status: NORMAL | LOW | OUT_OF_STOCK
└─ minimum_threshold

audit_logs
├─ entity_type, entity_id, action, user_id
├─ old_values, new_values, changes_summary
└─ timestamp, ip_address

notifications
├─ recipient_id, title, message, type
├─ is_read, read_at
└─ related_entity (for linking to orders, etc)
```

---

## 🔌 KEY API ENDPOINTS (30+)

### Auth (3)
```
POST   /auth/google-callback          (Login with Google)
POST   /auth/refresh                  (Refresh JWT token)
POST   /auth/logout                   (Logout)
```

### Orders (5)
```
POST   /orders                        (Create order)
GET    /orders {:orderId}             (Get single order)
GET    /orders                        (Get my orders)
PATCH  /orders/:orderId/cancel        (Cancel order)
PATCH  /orders/:orderId/status        (Update status)
```

### Payments (3)
```
POST   /payments/initiate             (Start Razorpay payment)
POST   /payments/verify               (Verify signature)
POST   /payments/:id/refund           (Refund payment)
```

### QR Codes (2)
```
POST   /qr/validate                   (Validate at counter)
GET    /qr/:token/status              (Check QR status)
```

### Menu (4)
```
GET    /menu                          (Get all items)
GET    /menu/:id                      (Get single item)
POST   /menu (admin)                  (Create item)
PATCH  /menu/:id (admin)              (Update item)
DELETE /menu/:id (admin)              (Delete item)
```

### Admin (6+)
```
GET    /admin/orders                  (All orders with filters)
GET    /admin/users                   (All users)
PATCH  /admin/users/:id/role          (Update user role)
GET    /admin/reports/daily           (Daily statistics)
GET    /admin/reports/range           (Date range report)
POST   /admin/settings                (Update system settings)
```

See **BACKEND_DEVELOPMENT_PROMPT.md** for complete endpoint spec.

---

## 🔒 SECURITY CHECKLIST

- ✅ JWT tokens (1h access, 7d refresh)
- ✅ Password hashing (bcryptjs)
- ✅ QR encryption (AES-256-CBC)
- ✅ Signature verification (Razorpay)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting (100 req/min per IP)
- ✅ CORS configured (frontend domain only)
- ✅ Helmet security headers
- ✅ Input validation (Joi/Zod)
- ✅ Audit logging (all changes)

---

## 📁 PROJECT STRUCTURE

```
backend/
├─ src/
│  ├─ config/           (DB, Redis, env)
│  ├─ middleware/       (Auth, errors, validation)
│  ├─ controllers/      (Request handlers)
│  ├─ services/         (Business logic)
│  ├─ models/           (Data access layer)
│  ├─ routes/           (Express routes)
│  ├─ utils/            (Helpers, loggers)
│  ├─ types/            (TypeScript interfaces)
│  ├─ migrations/       (SQL schema)
│  ├─ seeders/          (Initial data)
│  └─ app.ts            (Express setup)
├─ tests/               (Unit + integration)
├─ docker/              (Docker files)
├─ package.json
├─ tsconfig.json
└─ server.ts            (Entry point)
```

---

## ⚙️ SETUP COMMANDS

```bash
# Initialize
mkdir backend && cd backend
npm init -y
npm install express cors dotenv pg redis socket.io

# Dev Dependencies
npm install -D typescript @types/express @types/node @types/pg \
  nodemon ts-node prettier eslint

# Initialize TypeScript
npx tsc --init

# Create folders
mkdir -p src/{config,middleware,controllers,services,models,routes,utils,types,migrations,seeders}
mkdir -p tests/{unit,integration}

# Set up .env
cp .env.example .env.local
# Edit values

# Run dev server
npm run dev
```

---

## 🚀 WEEK 1 CHECKLIST (Foundation)

### Day 1-2: Setup
- [ ] Create `backend/` folder
- [ ] Run `npm init` + install deps
- [ ] Create `.env.local` with values
- [ ] Create folder structure
- [ ] Create `src/app.ts` (Express init)

### Day 3-4: Database
- [ ] Install PostgreSQL locally
- [ ] Create dev database
- [ ] Create `src/config/database.ts`
- [ ] Create migrations folder

### Day 5: Migrations
- [ ] Write schema migrations
- [ ] Run migrations
- [ ] Verify tables created
- [ ] Test database connection

**Result**: `npm run dev` starts server on localhost:5000 ✅

---

## 🔑 CRITICAL CODE PATTERNS

### 1. Database Query (Parameterized)
```typescript
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

### 2. JWT Token Generation
```typescript
const token = jwt.sign(
  { userId, role },
  process.env.JWT_SECRET!,
  { expiresIn: '1h' }
);
```

### 3. Error Handling
```typescript
try {
  // business logic
} catch (error) {
  res.status(500).json({
    success: false,
    error: { code: 'ERROR_CODE', message: 'Description' }
  });
}
```

### 4. Transaction (Multiple Operations)
```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  // Multiple queries
  await client.query('UPDATE ...');
  await client.query('INSERT ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### 5. QR Generation
```typescript
const qrToken = uuidv4();
const encrypted = encrypt(JSON.stringify(data));
const qrImage = await QRCode.toDataURL(encrypted);
```

---

## ⚠️ CRITICAL ISSUES

| Issue | Prevention |
|-------|-----------|
| **Forged QR** | Encrypt + sign, verify on every scan |
| **Double charge** | Verify signature, idempotency keys |
| **Race conditions** | Use DB transactions |
| **Token hijacking** | HTTPS only, short-lived tokens |
| **Slow queries** | Add indexes, use explain analyze |
| **Lost orders** | Persistent logging, data backups |

---

## 📊 PERFORMANCE TARGETS

```
API Response Time:
├─ GET requests: <200ms (p50), <500ms (p99)
├─ POST requests: <500ms (p50), <1s (p99)
├─ Payment ops: <3s total
└─ QR validation: <500ms

Database Performance:
├─ Query response: <50ms (avg)
├─ Connection pool: 20 connections max
├─ Indexes: On all WHERE/JOIN columns
└─ Query plan: EXPLAIN ANALYZE before prod

Throughput Capacity:
├─ Orders: 500+/day (peak 250+/hour)
├─ Concurrent users: 1000+
├─ Payments: 100 req/sec
└─ QR scans: 1000 req/min
```

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [ ] OrderService.calculateTotal()
- [ ] PaymentService.verifySignature()
- [ ] QRService.encrypt/decrypt()
- [ ] Auth validators

### Integration Tests
- [ ] Create order → Pay → Serve flow
- [ ] Payment verification with Razorpay
- [ ] Database transactions
- [ ] WebSocket connections

### Load Tests
- [ ] 1000 concurrent users
- [ ] 100 orders/minute
- [ ] 50 simultaneous payments
- [ ] Assert <1s response time

### Security Tests
- [ ] SQL injection attempts → blocked
- [ ] JWT tampering → rejected
- [ ] Invalid signatures → rejected
- [ ] Rate limiting → enforced

---

## 🔄 ORDER FLOW

```
Customer
  ↓
1. Browse menu: GET /menu
  ↓
2. Create order: POST /orders
   → Validate items
   → Generate QR code
   → Create database records
   → Return qrCode + orderId
  ↓
3. Initiate payment: POST /payments/initiate
   → Razorpay order created
   → Return razorpay URL
  ↓
4. Customer pays: [Razorpay UI]
  ↓
5. Verify payment: POST /payments/verify
   → Verify signature
   → Update order status → CONFIRMED
   → Emit WebSocket event
  ↓
6. Kitchen receives: WebSocket notification
  ↓
7. Order ready: Kitchen marks prepared
  ↓
8. Customer scans QR: POST /qr/validate
   → Verify signature
   → Decrypt payload
   → Mark order → SERVED
  ↓
Done ✅
```

---

## 🌐 WEBSOCKET EVENTS

### Server → Client (Receive)
```javascript
// Order updates
socket.on('order:updated', (order) => {})
socket.on('order:confirmed', (order) => {})
socket.on('order:served', (order) => {})

// Payments
socket.on('payment:confirmed', (payment) => {})
socket.on('payment:failed', (error) => {})

// Admin dashboard
socket.on('dashboard:update', (metrics) => {})
socket.on('inventory:alert', (item) => {})
```

### Client → Server (Send)
```javascript
// Subscribe to order
socket.emit('order:subscribe', { orderId: 'xxx' })

// Admin connect
socket.emit('admin:connect')

// Mark notification read
socket.emit('notification:mark-read', { notificationId })
```

---

## 📞 DEBUGGING CHECKLIST

| Problem | Check |
|---------|-------|
| 401 Unauthorized | Token in localStorage? Valid JWT? |
| 404 Endpoint | Route file imported in main router? |
| Payment fails | Razorpay keys correct? Signature verified? |
| QR invalid | Encrypted properly? Signature correct? Expired? |
| WebSocket fails | Socket.io running? Token valid? |
| Slow queries | Run EXPLAIN ANALYZE? Index exist? |
| Database error | Connection string correct? DB exists? |
| Email not sent | SendGrid key? Template valid? |

---

## 🚀 RAPID DEPLOYMENT

```bash
# 1. Build
npm run build

# 2. Create Docker image
docker build -t cse-backend:latest .

# 3. Run locally
docker run -p 5000:5000 cse-backend

# 4. Push to cloud
docker push your-registry/cse-backend:latest

# 5. Deploy
kubectl apply -f deployment.yaml  # or your method

# 6. Verify
curl https://api.domain.com/health
```

---

## 📚 WHEN YOU GET STUCK

| Problem | Solution |
|---------|----------|
| Don't know how to start | Read BACKEND_QUICKSTART.md Week 1 Day 1 |
| Need API spec | Check BACKEND_DEVELOPMENT_PROMPT.md API section |
| Database question | See BACKEND_DEVELOPMENT_PROMPT.md schema section |
| Payment issue | Review payment service in QUICKSTART Week 3 |
| Real-time question | See WebSocket section in DEVELOPMENT_PROMPT.md |
| Deployment question | Check COMPLETE_ROADMAP.md deployment section |

---

## ✅ SUCCESS MILESTONES

```
Week 1  → Can login with backend JWT ✅
Week 2  → Can create orders ✅
Week 3  → Can process payments ✅
Week 4  → Can generate & validate QR ✅
Week 5  → Real-time updates working ✅
Week 6  → Admin dashboard functional ✅
Week 7  → Docker image builds ✅
Week 8  → Live in production ✅
```

---

## 🎉 YOU HAVE EVERYTHING NEEDED!

✅ Complete architecture  
✅ Database schema (ready to copy)  
✅ API specification  
✅ Code snippets  
✅ Step-by-step guide  
✅ Security measures  
✅ Testing strategy  
✅ Deployment plan  

**NOW START BUILDING!** 🚀

---

**Reference Document**: Complete Backend Development  
**Status**: Production Ready  
**Print This Page**: Yes! Keep it handy while coding.


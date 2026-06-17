# ⚡ IMMEDIATE ACTION PLAN — Start NOW

**Your Goal**: 60% → 99% Backend (All except real Razorpay)  
**Timeline**: 3-5 days  
**Effort**: ~40-50 hours focused work  

---

## 🎯 YOUR MISSION

Complete these 7 components in priority order:
1. ✅ **Auth System** (Login, Register, Tokens)
2. ✅ **Menu API** (Get items, categories, search)
3. ✅ **Payment Mocking** (Test order flow)
4. ✅ **Admin Dashboard** (Reports, user management)
5. ✅ **Real-time Events** (Socket.io)
6. ✅ **Notifications** (Broadcasting updates)
7. ✅ **Polish & Testing** (Final verification)

---

## 🚀 START HERE (Next 2 Hours)

### Step 1: Create All Missing Files (10 minutes)
```powershell
cd backend

# Services
New-Item -Path src/services/auth.service.ts -Force
New-Item -Path src/services/user.service.ts -Force
New-Item -Path src/services/menu.service.ts -Force
New-Item -Path src/services/payment.service.ts -Force
New-Item -Path src/services/admin.service.ts -Force
New-Item -Path src/services/reporting.service.ts -Force
New-Item -Path src/services/notification.service.ts -Force

# Routes
New-Item -Path src/routes/auth.routes.ts -Force
New-Item -Path src/routes/menu.routes.ts -Force
New-Item -Path src/routes/payment.routes.ts -
Force
New-Item -Path src/routes/admin.routes.ts -Force

# Controllers
New-Item -Path src/controllers/auth.controller.ts -Force
New-Item -Path src/controllers/menu.controller.ts -Force
New-Item -Path src/controllers/payment.controller.ts -Force
New-Item -Path src/controllers/admin.controller.ts -Force

# Config
New-Item -Path src/config/socket.ts -Force
```

### Step 2: Verify Server Still Running (5 minutes)
```powershell
# Terminal 1: Check if server is still up
curl http://localhost:5000/health

# Should return:
# {"status":"OK","timestamp":"...","uptime":...}

# If not running, start it:
npm run dev
```

### Step 3: Start Implementing AUTH Service (NOW!)
Go to `BACKEND_SPRINT_GUIDE.md` → **SPRINT 1: AUTH & USER MANAGEMENT**

---

## 📋 TODAY'S CHECKLIST (Day 1)

### Morning: Build Auth Service
- [ ] Create `backend/src/services/auth.service.ts`
  - `generateTokens()` method
  - `verifyToken()` method
  - `refreshToken()` method
  - `hashPassword()` method
  - `validatePassword()` method

- [ ] Create `backend/src/services/user.service.ts`
  - `createUser()` method
  - `getUserById()` method
  - `updateUserProfile()` method
  - `listUsers()` method

- [ ] Test locally:
  ```bash
  npm run dev  # Terminal 1
  # Manually test with curl in Terminal 2
  ```

### Afternoon: Build Auth Routes & Controller
- [ ] Create `backend/src/routes/auth.routes.ts`
  - POST /auth/register
  - POST /auth/login
  - POST /auth/refresh-token
  - GET /auth/me
  - PATCH /auth/profile

- [ ] Create `backend/src/controllers/auth.controller.ts`
  - registerHandler()
  - loginHandler()
  - refreshHandler()
  - getMeHandler()
  - updateProfileHandler()

- [ ] Update `backend/src/routes/index.ts`
  ```typescript
  router.use('/auth', authRoutes);
  ```

- [ ] Update `backend/src/app.ts`
  ```typescript
  app.use(API_PREFIX, routes);
  ```

### Evening: Test & Debug
- [ ] Run test suite:
  ```bash
  node test-endpoints.js
  ```
  - Should still show 25+ passing tests
  - No errors from new endpoints yet (expected)

- [ ] Manually test with curl:
  ```bash
  # Register
  curl -X POST http://localhost:5000/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"firebaseUid":"test-uid","email":"test@example.com","name":"Test User"}'

  # Login
  curl -X POST http://localhost:5000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"firebaseUid":"test-uid"}'
  ```

---

## 🔄 DAILY WORKFLOW TEMPLATE

Each day, follow this pattern:

### Setup (Start of Day)
```bash
cd D:\CSE-Cafeteria-Automation-mobile\backend

# Terminal 1: Start server
npm run dev

# Terminal 2: Watch tests (in root, not backend)
node test-endpoints.js

# Terminal 3: Work on code (VS Code)
code .
```

### During Day (Every 1-2 hours)
1. Implement a service/route/controller
2. Run tests: `node test-endpoints.js`
3. Fix any errors (logs in Terminal 1)
4. Commit to git
5. Move to next task

### End of Day
- [ ] Git commit with message: "Day 1: Auth service + routes"
- [ ] Update `BACKEND_SPRINT_GUIDE.md` with status
- [ ] Note any blockers

---

## 💻 CODING TEMPLATES (Copy-Paste Ready)

### Template 1: Service Class
```typescript
// backend/src/services/xyz.service.ts
import { logger } from '../utils/logger';
import { query, getClient } from '../config/database';

export class XyzService {
  constructor() {}

  async method1(param: string): Promise<any> {
    try {
      const result = await query(
        `SELECT * FROM some_table WHERE id = $1`,
        [param]
      );
      
      logger.info('Method1 called', { param });
      return result.rows[0];
    } catch (error) {
      logger.error('Method1 failed', { error, param });
      throw error;
    }
  }

  async method2(data: any): Promise<any> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      // Do stuff
      
      await client.query('COMMIT');
      logger.info('Method2 succeeded');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Method2 failed', { error });
      throw error;
    } finally {
      client.release();
    }
  }
}

export const xyzService = new XyzService();
```

### Template 2: Controller Class
```typescript
// backend/src/controllers/xyz.controller.ts
import { Response, NextFunction } from 'express';
import { xyzService } from '../services/xyz.service';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { logger } from '../utils/logger';

export class XyzController {
  constructor(private service: any) {}

  handler1 = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.method1(req.body);
      sendSuccess(res, 200, { data: result });
    } catch (error) {
      next(error);
    }
  };

  handler2 = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.method2(req.body);
      sendSuccess(res, 201, { data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const xyzController = new XyzController(xyzService);
```

### Template 3: Routes File
```typescript
// backend/src/routes/xyz.routes.ts
import { Router } from 'express';
import { xyzController } from '../controllers/xyz.controller';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// Your endpoints below
router.get('/', xyzController.handler1);
router.post('/', requireRole('admin'), validateBody(createSchema), xyzController.handler2);

export default router;
```

---

## ✅ QUALITY CHECKLIST

Before committing each feature, verify:

- [ ] **Compiles**: `npm run build` returns no errors
- [ ] **No console errors**: `npm run dev` startup is clean
- [ ] **Tests updated**: New tests in `test-endpoints.js`
- [ ] **Tests passing**: `node test-endpoints.js` shows ✅
- [ ] **TypeScript valid**: `npx tsc --noEmit` returns 0 errors
- [ ] **Logger calls**: Key operations logged (DEBUG/INFO level)
- [ ] **Error handling**: All catches re-throw or respond with error
- [ ] **Types defined**: New interfaces in `src/types/index.ts`
- [ ] **Validation applied**: All user inputs validated
- [ ] **Comments added**: Complex logic has JSDoc comments

---

## 🚨 COMMON PITFALLS (Avoid These!)

### ❌ DON'T:
- Don't forget `await` on async calls (causes hanging)
- Don't forget to call `client.release()` after transactions
- Don't throw errors without logging them first
- Don't use string concatenation in SQL (use parameterized)
- Don't forget to add middleware `app.use(authMiddleware)` for protected routes
- Don't forget role checks on admin routes
- Don't ship without TypeScript compile check

### ✅ DO:
- Always await async operations
- Always release DB clients in finally block
- Always log before throwing (for debugging)
- Always use parameterized queries: `$1, $2, $3`
- Always add auth middleware unless public endpoint
- Always add `requireRole()` for admin/staff endpoints
- Always run `npm run typecheck` before committing

---

## 📞 QUICK DEBUG COMMANDS

If something breaks:

```bash
# Check server logs
npm run dev

# Check for TypeScript errors
npx tsc --noEmit

# Check all ESLint issues
npm run lint

# Manually test an endpoint
curl -X GET http://localhost:5000/api/v1/health

# View database tables
psql -U postgres -d cse_cafeteria_dev -c "\dt"

# Check active connections
psql -U postgres -d cse_cafeteria_dev -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'cse_cafeteria_dev';"
```

---

## 📊 PROGRESS TRACKING

Update your status daily:

### Day 1 Progress
- [ ] Auth Service: ✅/❌
- [ ] User Service: ✅/❌
- [ ] Auth Routes: ✅/❌
- [ ] Auth Controller: ✅/❌
- [ ] Tests passing: ✅/❌
- **Target**: Login/register working

### Day 2 Progress
- [ ] Menu Service: ✅/❌
- [ ] Menu Routes & Controller: ✅/❌
- [ ] Payment Mock Service: ✅/❌
- [ ] Payment Routes & Controller: ✅/❌
- **Target**: Menu API + mock payments

### Day 3 Progress
- [ ] Admin Service: ✅/❌
- [ ] Reporting Service: ✅/❌
- [ ] Admin Routes & Controller: ✅/❌
- **Target**: Admin dashboard working

### Day 4 Progress
- [ ] Socket.io setup: ✅/❌
- [ ] Notification Service: ✅/❌
- [ ] Real-time handlers: ✅/❌
- **Target**: Live updates working

### Day 5 Progress
- [ ] Rate limiting: ✅/❌
- [ ] Test suite updated: ✅/❌
- [ ] All 50+ tests passing: ✅/❌
- [ ] Documentation complete: ✅/❌
- **Target**: 99% system COMPLETE

---

## 🎉 SUCCESS = This Checklist Complete

By end of Sprint (Day 5):

```
✅ Backend server running (no crashes)
✅ PostgreSQL connected (11 tables)
✅ 5 services implemented (Auth, User, Menu, Payment, Admin)
✅ 4 additional services (Reporting, Notification, Cache, Audit)
✅ 12 new routes (auth, menu, payment, admin)
✅ 4 new controllers
✅ 35+ total API endpoints
✅ 50+ passing tests
✅ Zero TypeScript errors
✅ Socket.io configured
✅ Mock payment system working
✅ All admin reports functional
✅ Real-time events broadcasting
✅ Full error handling
✅ Complete documentation
✅ Ready for payment integration (Phase X)
✅ Ready for frontend integration (Phase Y)
```

---

## 🚀 FIRE UP NOW!

```bash
# 1. Create files (2 min)
cd backend
# Run the file creation commands above

# 2. Start server (3 min)
npm run dev

# 3. Open VS Code (1 min)
code .

# 4. READ THE SPRINT GUIDE (15 min)
# Open: BACKEND_SPRINT_GUIDE.md → SPRINT 1

# 5. START CODING Auth Service (30 min)
# Create: src/services/auth.service.ts
# Copy template from above
# Implement the methods

# 6. TEST (5 min)
# Run: node test-endpoints.js
# Verify no regressions

# REPEAT FOR EACH COMPONENT
```

---

**YOU'RE READY TO BUILD! 🚀**

Start with **Auth Service** right now.  
Follow the sprint guide.  
Test after each feature.  
You've got this! 💪

**PAYMENT INTEGRATION = Tomorrow's Problem** ✅

// Seeding script for BKT11 menu item via Firebase REST API
const apiKey = "AIzaSyBRzOIMBTExHkfM92EMNfCodh63t54OKSw";
const projectId = "csecafe-a7fff";

async function run() {
  console.log("🚀 Initializing BKT11 Firestore Seeder...");
  
  const credentials = [
    { email: "admin@cse.com", password: "admin123" },
    { email: "admin@csecafe.com", password: "cseadmin2026" }
  ];

  let idToken = null;
  let authenticatedUser = null;

  for (const cred of credentials) {
    try {
      console.log(`🔑 Attempting authentication with ${cred.email}...`);
      const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cred.email,
          password: cred.password,
          returnSecureToken: true
        })
      });
      
      const loginData = await loginRes.json();
      if (loginData.idToken) {
        idToken = loginData.idToken;
        authenticatedUser = cred.email;
        console.log(`✅ Authenticated successfully as ${cred.email}`);
        break;
      } else {
        console.warn(`⚠️ Authentication failed for ${cred.email}: ${JSON.stringify(loginData.error?.message || loginData)}`);
      }
    } catch (e) {
      console.error(`❌ Connection error during auth with ${cred.email}:`, e.message);
    }
  }

  if (!idToken) {
    console.error("❌ Could not authenticate with any admin credentials. Seeding aborted.");
    process.exit(1);
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`
  };

  // 1. Seed Menu Item
  console.log("📦 Seeding menu/BKT11...");
  const menuDoc = {
    fields: {
      id: { stringValue: "BKT11" },
      name: { stringValue: "2 Idli + 2 Mirchi" },
      price: { doubleValue: 35 },
      costPrice: { doubleValue: 14 },
      category: { stringValue: "Breakfast" },
      imageUrl: { stringValue: "/assets/menu/idli_mirchi.jpg" },
      active: { booleanValue: true }
    }
  };

  const menuRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/menu/BKT11`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(menuDoc)
    }
  );
  
  if (menuRes.ok) {
    console.log("✅ menu/BKT11 document created/updated successfully.");
  } else {
    console.error("❌ Failed to seed menu/BKT11:", await menuRes.text());
  }

  // 2. Seed Inventory Item
  console.log("📦 Seeding inventory/BKT11...");
  const inventoryDoc = {
    fields: {
      itemId: { stringValue: "BKT11" },
      itemName: { stringValue: "2 Idli + 2 Mirchi" },
      openingStock: { integerValue: 100 },
      consumed: { integerValue: 0 },
      category: { stringValue: "Breakfast" },
      lastUpdated: { timestampValue: new Date().toISOString() }
    }
  };

  const inventoryRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/BKT11`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(inventoryDoc)
    }
  );

  if (inventoryRes.ok) {
    console.log("✅ inventory/BKT11 document created/updated successfully.");
  } else {
    console.error("❌ Failed to seed inventory/BKT11:", await inventoryRes.text());
  }

  // 3. Seed Inventory Meta Item
  console.log("📦 Seeding inventory_meta/BKT11...");
  const metaDoc = {
    fields: {
      consumed: { integerValue: 0 },
      updatedAt: { doubleValue: Date.now() }
    }
  };

  const metaRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory_meta/BKT11`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(metaDoc)
    }
  );

  if (metaRes.ok) {
    console.log("✅ inventory_meta/BKT11 document created/updated successfully.");
  } else {
    console.error("❌ Failed to seed inventory_meta/BKT11:", await metaRes.text());
  }

  console.log("🎉 Database seeding complete!");
}

run().catch(console.error);

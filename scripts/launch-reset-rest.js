const apiKey = "AIzaSyBRzOIMBTExHkfM92EMNfCodh63t54OKSw";
const projectId = "csecafe-a7fff";

async function run() {
  console.log("🚀 Starting Launch Reset Protocol (REST)...");
  
  const credentials = [
    { email: "admin@cse.com", password: "admin123" },
    { email: "admin@csecafe.com", password: "cseadmin2026" }
  ];

  let idToken = null;
  for (const cred of credentials) {
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cred.email, password: cred.password, returnSecureToken: true })
      });
      const data = await res.json();
      if (data.idToken) { idToken = data.idToken; break; }
    } catch (e) {}
  }

  if (!idToken) {
    console.error("❌ Could not authenticate as admin.");
    process.exit(1);
  }

  const headers = { "Authorization": `Bearer ${idToken}` };

  async function wipeCollection(col) {
    console.log(`🧹 Clearing ${col}...`);
    let deleted = 0;
    while (true) {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}?pageSize=300`, { headers });
      const data = await res.json();
      if (!data.documents || data.documents.length === 0) break;
      
      for (const doc of data.documents) {
        await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, { method: "DELETE", headers });
        deleted++;
      }
      
      console.log(`   ...deleted ${deleted} docs so far`);
    }
    console.log(`✅ Finished clearing ${col}. Total deleted: ${deleted}.`);
  }

  await wipeCollection("orders");
  await wipeCollection("prepBatches");
  await wipeCollection("wallet_recharge_requests");
  await wipeCollection("reports");
  await wipeCollection("hardware_scans");
  await wipeCollection("server_logs");

  console.log("🧹 Resetting User Data...");
  let userCount = 0;
  let pageToken = "";
  while (true) {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?pageSize=300${pageParam}`, { headers });
    const data = await res.json();
    if (!data.documents || data.documents.length === 0) break;
    for (const doc of data.documents) {
      const updateDoc = {
        fields: {
          ...doc.fields,
          points: { integerValue: 0 },
          xp: { integerValue: 0 },
          level: { integerValue: 1 },
          frequency: { integerValue: 0 },
          totalSpent: { integerValue: 0 },
          ordersCount: { integerValue: 0 },
          streakCount: { integerValue: 0 }
        }
      };
      await fetch(`https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=points&updateMask.fieldPaths=xp&updateMask.fieldPaths=level&updateMask.fieldPaths=frequency&updateMask.fieldPaths=totalSpent&updateMask.fieldPaths=ordersCount&updateMask.fieldPaths=streakCount`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(updateDoc)
      });
      userCount++;
    }
    if (data.nextPageToken) pageToken = data.nextPageToken;
    else break;
  }
  console.log(`✅ Reset points for ${userCount} users.`);

  console.log("🧹 Resetting Inventory...");
  const invRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory_meta`, { headers });
  const invData = await invRes.json();
  if (invData.documents) {
    for (const doc of invData.documents) {
      await fetch(`https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=consumed`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { consumed: { integerValue: 0 } } })
      });
    }
  }
  console.log("✅ Reset inventory consumption.");
  console.log("🎉 All mock data wiped successfully! Ready for tomorrow's launch.");
}

run().catch(console.error);

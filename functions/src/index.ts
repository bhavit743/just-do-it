// src/functions/index.ts
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params"; 
import * as admin from "firebase-admin"; 

// Ensure fetch is available in the environment
const fetch = require("node-fetch"); 

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// --- 1. DEFINE the secret (V2 Standard) ---
const geminiApiKey = defineString("MY_APP_GEMINI_KEY");

// --- IST Helper Functions (Unchanged) ---
const IST_OFFSET = 19800000;
function formatToIST_YYYY_MM_DD(date: Date | number): string {
    const utcMillis = new Date(date).getTime();
    const istDate = new Date(utcMillis + IST_OFFSET);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ----------------------------------------------------------------------
// --- MAIN CALLABLE FUNCTIONS (FIXED) ---
// ----------------------------------------------------------------------

export const updateCategory = onCall({}, async (request) => {
    // 1. Authenticate the user
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const userId = request.auth.uid;

    // 2. Get the data from the form
    const { categoryId, oldName, newName, newKeywords, newColor } = request.data;

    if (!categoryId || !oldName || !newName || !newKeywords || !newColor) {
        throw new HttpsError("invalid-argument", "Missing required data.");
    }
    
    // Prevent renaming to an existing category
    if (oldName !== newName) {
        const catQuery = await db.collection(`users/${userId}/categories`).where('name', '==', newName).get();
        if (!catQuery.empty) {
            throw new HttpsError("already-exists", "A category with this name already exists.");
        }
    }

    try {
        // 3. Create a batch
        const batch = db.batch();

        // 4. Find all expenses with the oldName
        const expensesRef = db.collection(`users/${userId}/expenses`);
        const q = expensesRef.where('category', '==', oldName);
        const expensesSnap = await q.get();

        // 5. Add an update operation for each matching expense
        expensesSnap.docs.forEach(doc => {
            batch.update(doc.ref, { category: newName });
        });

        // 6. Add an update for the category document itself
        const categoryRef = db.doc(`users/${userId}/categories/${categoryId}`);
        batch.update(categoryRef, {
            name: newName,
            keywords: newKeywords,
            color: newColor
        });

        // 7. Commit all changes at once
        await batch.commit();
        
        return { status: "success", updatedCount: expensesSnap.size };

    } catch (error) {
        console.error("Error in updateCategory:", error);
        throw new HttpsError("internal", "An error occurred while updating the category.");
    }
});


export const scanReceipt = onCall(async (request) => {
    
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const userId = request.auth.uid;
    const { base64Data } = request.data;
    if (!base64Data) {
        throw new HttpsError("invalid-argument", "Missing image data.");
    }
    
    const mimeType = inferMimeType(base64Data);

    try {
        const categoriesSnap = await db.collection(`users/${userId}/categories`).get();
        const categories = categoriesSnap.docs.map(doc => doc.data());
        
        // Use the .value() method from the defined secret
        const extractedData = await callGeminiAPI(geminiApiKey.value(), base64Data, mimeType, categories);
        const savedData = await saveExpense(extractedData, userId, categories);
        return { status: "success", savedData: savedData };
    } catch (error) {
        console.error("Error in scanReceipt:", error);
        throw new HttpsError("internal", "An error occurred while scanning.");
    }
});


export const httpScanReceipt = onRequest(
  { cors: true }, 
  async (request, response) => {
    
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const { uid, token } = request.query;
    if (typeof uid !== "string" || typeof token !== "string") {
      response.status(400).send("Bad Request: Missing uid or token.");
      return;
    }

    try {
      
      const userDoc = await db.doc(`users/${uid}`).get();
      if (!userDoc.exists) {
        response.status(404).send("User not found.");
        return;
      }

      const secretToken = userDoc.data()?.secretUploadToken;
      if (!secretToken || token !== secretToken) {
        response.status(401).send("Unauthorized: Invalid token.");
        return;
      }

      const { base64Data } = request.body;
      if (!base64Data) {
        response.status(400).send("Bad Request: Missing image data.");
        return;
      }

      const mimeType = inferMimeType(base64Data);

      const categoriesSnap = await db.collection(`users/${uid}/categories`).get();
      const categories = categoriesSnap.docs.map(doc => doc.data());

      // Use the .value() method from the defined secret
      const extractedData = await callGeminiAPI(geminiApiKey.value(), base64Data, mimeType, categories);
      const savedData = await saveExpense(extractedData, uid, categories);

      response.status(200).send({ status: "success", savedData });

    } catch (error) {
      console.error("Error in httpScanReceipt:", error);
      response.status(500).send("Internal Server Error.");
    }
  }
);


/**
 * Deletes a Group document AND all its associated subcollection expenses (Cascading Deletion).
 * Callable from the client-side.
 */
export const deleteGroupAndExpenses = onCall(async (request) => { // FIX 1: Removed redundant context argument
    
    // FIX 2 & 3: Use request.auth and request.data for access
    const userId = request.auth?.uid;
    const groupId = request.data.groupId;

    if (!userId) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    if (!groupId) {
        throw new HttpsError('invalid-argument', 'Group ID is required.'); // FIX 3: Property check
    }

    const groupRef = db.doc(`users/${userId}/groups/${groupId}`);
    const expensesRef = db.collection(`users/${userId}/groups/${groupId}/expenses`);

    try {
        // 1. Delete all documents in the 'expenses' subcollection
        const snapshot = await expensesRef.listDocuments();
        const deletePromises: Promise<FirebaseFirestore.WriteResult>[] = []; // FIX 4: Explicitly type array
        
        snapshot.forEach(docRef => {
            deletePromises.push(docRef.delete());
        });

        await Promise.all(deletePromises); // FIX 5: No change needed here
        console.log(`Deleted ${snapshot.length} expenses from group ${groupId}`);

        // 2. Delete the parent Group document
        await groupRef.delete();
        
        return { status: "success", message: "Group and all expenses deleted successfully." };

    } catch (error) {
        console.error(`Error deleting group ${groupId}:`, error);
        throw new HttpsError('internal', 'Failed to perform cascading deletion.', error);
    }
});


// ----------------------------------------------------------------------
// --- HELPER FUNCTION DEFINITIONS ---
// ----------------------------------------------------------------------

// Infer MIME type (REQUIRED for base64 scanning)
function inferMimeType(base64Data: string): string {
    const signature = base64Data.substring(0, 5);
    if (signature === "/9j/4") {
        return "image/jpeg";
    }
    if (signature === "iVBOR") {
        return "image/png";
    }
    return "image/jpeg";
}

// Update callGeminiAPI to *receive* the key (REQUIRED for Gemini calls)
async function callGeminiAPI(apiKey: string, imageData: string, imageMimeType: string, categories: any[]) {
    if (!apiKey) {
        throw new HttpsError("internal", "Gemini API Key is not available.");
    }

    // This cleans the Base64 string
    const cleanedData = imageData.replace(/(\r\n|\n|\r)/gm, "");

    const keywordMap: { [key: string]: string } = {};
    categories.forEach(cat => {
        (cat.keywords || []).forEach((kw: string) => {
            keywordMap[kw.toUpperCase()] = cat.name;
        });
    });
    const mappingString = JSON.stringify(keywordMap);
    
    const systemPrompt = "Analyze the payment receipt screenshot. Extract the data as JSON.";
    const userPrompt = `Extract the following data: 1. amount (number). 2. merchantName (string, the store, business, or person *receiving* the payment. Do NOT extract the sender's name). 3. transaction date (YYYY-MM-DD). Use the mapping ${mappingString} to find the appropriate category. If no match, use 'UNCATEGORIZED'. The output MUST be valid JSON.`;
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
        // Use the cleanedData
        contents: [{ role: "user", parts: [{ text: userPrompt }, { inlineData: { mimeType: imageMimeType, data: cleanedData } }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: { 
                type: "OBJECT", 
                properties: { 
                    "amount": { "type": "NUMBER" }, 
                    "merchantName": { "type": "STRING" }, 
                    "category": { "type": "STRING" }, 
                    "date": { "type": "STRING", "description": "YYYY-MM-DD" } 
                }, 
                required: ["amount", "merchantName", "category", "date"] 
            }
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`API failed: ${errorBody.error?.message || response.statusText}`);
    }
    
    const result: any = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!jsonText) throw new Error("No text response from API.");
    return JSON.parse(jsonText);
}

// saveExpense function (REQUIRED for saving the transaction)
async function saveExpense(extractedData: any, userId: string, categories: any[]) {
    let finalCategory = (extractedData.category || 'UNCATEGORIZED').toUpperCase();
    const categoryMatch = categories.find(c => c.name === finalCategory);

    if (!finalCategory) finalCategory = 'UNCATEGORIZED';

    const expenseData = {
        amount: parseFloat(extractedData.amount || 0),
        payerName: (extractedData.merchantName || 'Unknown').trim(),
        category: finalCategory,
        timestamp: admin.firestore.Timestamp.fromDate(new Date((extractedData.date || formatToIST_YYYY_MM_DD(new Date())) + 'T00:00:00')),
        userId: userId,
        headcount: 1,
        note: "Expense",
        frequency: "Non-recurring",
    };

    await db.collection(`users/${userId}/expenses`).add(expenseData);

    if (!categoryMatch && finalCategory !== 'UNCATEGORIZED') {
        await db.collection(`users/${userId}/categories`).add({
            name: finalCategory,
            keywords: [finalCategory],
            color: '#6B7280', // Default color
            createdAt: admin.firestore.Timestamp.now(),
        });
    }
    
    return expenseData;
}

export const searchUsers = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const searchText = (request.data.query || "").trim().toLowerCase();

    try {
        // FIX: Explicitly cast to 'FirebaseFirestore.Query' so we can overwrite it later
        let usersQuery: FirebaseFirestore.Query = db.collection("users");

        // If there is a search term, filter by it.
        if (searchText.length > 0) {
            usersQuery = usersQuery
                .where("username", ">=", searchText)
                .where("username", "<=", searchText + "\uf8ff");
        }

        // Now 'usersQuery' is always a Query, so .limit().get() works fine
        const snapshot = await usersQuery.limit(10).get();

        return snapshot.docs.map(doc => ({
            uid: doc.id,
            username: doc.data().username,
            email: doc.data().email
        }));

    } catch (error) {
        console.error("Error searching users:", error);
        throw new HttpsError("internal", "Search failed.");
    }
});


// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * =================================================================
 * 1. CHECK USERNAME (for Signup)
 * =================================================================
 */
exports.checkUsernameExists = functions.https.onCall(async (data) => {
  try {
    const username = data.username;

    if (!username || username.length < 3) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Username must be at least 3 characters long.",
      );
    }

    const usernameRef = db.collection("usernames").doc(username);
    const doc = await usernameRef.get();

    return { exists: doc.exists };
  } catch (error) {
    console.error("Error in checkUsernameExists:", error);
    throw new functions.https.HttpsError(
      "internal",
      "An internal error occurred.",
    );
  }
});

/**
 * =================================================================
 * 2. GET EMAIL (for Login)
 * =================================================================
 */
exports.getEmailForUsername = functions.https.onCall(async (data) => {
  try {
    const username = data.username;

    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("username", "==", username).limit(1).get();

    if (snapshot.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        "No user found with that username.",
      );
    }

    const userDoc = snapshot.docs[0];
    const email = userDoc.data().email;

    return { email: email };
  } catch (error) { // <-- THIS BLOCK IS NOW FIXED
    if (error instanceof functions.https.HttpsError) {
      throw error; // Re-throw errors we created on purpose
    }
    // Log the unexpected error
    console.error("Error in getEmailForUsername:", error);
    // Throw a generic error to the client
    throw new functions.https.HttpsError(
      "internal",
      "An internal error occurred.",
    );
  }
});
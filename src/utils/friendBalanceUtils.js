import { db } from '../firebaseConfig';
import { doc, runTransaction } from 'firebase/firestore';

/**
 * Updates the balance between two users in an atomic transaction.
 * This is performed on the current user's ledger (users/{userId}/friends/{friendDocId}).
 * * @param {string} userId - The UID of the current user (the one logged in).
 * @param {string} friendDocId - The Firestore document ID of the friend in the user's 'friends' subcollection.
 * @param {number} amountChange - The net change in debt. Positive if the friend now owes more to the user.
 */
export async function updateFriendBalance(userId, friendDocId, amountChange) {
    if (amountChange === 0) return;

    const friendRef = doc(db, `users/${userId}/friends`, friendDocId);

    try {
        await runTransaction(db, async (transaction) => {
            const friendDoc = await transaction.get(friendRef);

            if (!friendDoc.exists) {
                throw new Error("Friend ledger not found for balance update.");
            }

            const currentBalance = friendDoc.data().balance || 0;
            // Balance logic: newBalance = current + (amount Friend owes User)
            const newBalance = currentBalance + amountChange; 

            transaction.update(friendRef, { balance: newBalance });
        });
    } catch (error) {
        console.error("Transaction failed during balance update:", error);
        // Throw to allow the calling function (AddExpense) to handle the failure
        throw new Error("Failed to update balance due to a transaction error.");
    }
}
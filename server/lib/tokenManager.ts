import { firestore } from 'firebase-admin'; // For types like firestore.Firestore, firestore.FieldValue
import { admin } from '../firebase'; // Assuming admin is exported from firebase.ts

// Define specific transaction types based on your Firestore schema for 'tokenTransactions'
// This should align with the `transactionType` field in your Firestore schema.
export type TransactionType =
  | 'purchase'          // User buys tokens
  | 'earn_service_fee'  // Provider earns from a service
  | 'spend_service_fee' // Resident pays for a service (escrow hold)
  | 'escrow_hold'       // Tokens moved from balance to escrow
  | 'escrow_release'    // Escrowed tokens moved from escrow to provider (part of earn_service_fee logic)
                      // or back to resident (part of refund_escrow logic)
  | 'spend_project_contribution' // User contributes to a project
  | 'spend_cause_donation'       // User donates to a cause
  | 'refund_escrow'     // Escrowed tokens returned to original payer (e.g., resident on cancellation)
  | 'admin_credit'      // Admin grants tokens
  | 'admin_debit'       // Admin removes tokens
  | 'payout_redeem'     // User redeems tokens for off-platform value
  | 'fee_platform';     // Platform fee deduction

export interface TransactionDetails {
  userId: string;       // Firebase UID of the user whose wallet is primarily affected
  type: TransactionType;
  amount: number;       // For balance: positive for credit, negative for debit.
                        // For escrow: this 'amount' still refers to balance impact. Escrow impact is separate.
  description: string;
  referenceId?: string; // e.g., bookingId, projectId, causeId
  escrowChange?: number; // Positive to increase user's escrow, negative to decrease user's escrow.
                        // E.g., for escrow_hold: amount = -X (decrease balance), escrowChange = +X (increase escrow)
                        // E.g., for escrow_release to provider: (on provider's transaction) amount = +X (increase balance)
                        // E.g., for escrow_release from resident: (on resident's transaction) escrowChange = -X (decrease escrow)
  initiatorId?: string; // UID of user/admin initiating the transaction, if different from userId
}

/**
 * Atomically records a token transaction and updates the user's wallet.
 * This function should be the single source of truth for modifying wallet balances.
 * @param db Firestore instance
 * @param details TransactionDetails object
 * @returns The ID of the newly created transaction document.
 * @throws Error if wallet not found, insufficient balance, or Firestore transaction fails.
 */
export async function recordTransactionAndUpdateWallet(
  db: firestore.Firestore, // Pass Firestore instance for testability, or use admin.firestore() directly
  details: TransactionDetails
): Promise<{ transactionId: string }> {
  const {
    userId,
    type,
    amount, // This is the impact on the main balance.
    description,
    referenceId,
    escrowChange = 0, // Explicitly 0 if not provided.
    initiatorId
  } = details;

  if (amount === 0 && escrowChange === 0) {
    // This indicates no actual change to the wallet's monetary values.
    // Might still be valid for logging certain non-financial events if needed, but typically a financial transaction implies change.
    throw new Error('Transaction amount and escrow change cannot both be zero for a financial ledger entry.');
  }

  const walletRef = db.collection('tokenWallets').doc(userId);
  const transactionCollectionRef = db.collection('tokenTransactions');
  const newTransactionRef = transactionCollectionRef.doc(); // Auto-generate ID for the new transaction

  try {
    await db.runTransaction(async (t) => {
      const walletDoc = await t.get(walletRef);
      if (!walletDoc.exists) {
        // This could happen if wallet creation failed during registration or user is invalid.
        // Depending on policy, you might auto-create a wallet here, but it's safer to assume it should exist.
        throw new Error(`Wallet not found for user ${userId}. Cannot record transaction.`);
      }

      const walletData = walletDoc.data()!; // data() will not be null if exists is true
      const currentBalance = walletData.balance || 0;
      const currentEscrowBalance = walletData.escrowBalance || 0;

      const newBalance = currentBalance + amount; // `amount` can be negative for debits
      const newEscrowBalance = currentEscrowBalance + escrowChange; // `escrowChange` can be negative

      // Validate balances
      if (newBalance < 0) {
        throw new Error(`Insufficient balance for user ${userId}. Current: ${currentBalance}, Tried to debit: ${Math.abs(amount)}`);
      }
      if (newEscrowBalance < 0) {
        throw new Error(`Insufficient escrow balance for user ${userId}. Current: ${currentEscrowBalance}, Tried to release/debit: ${Math.abs(escrowChange)}`);
      }

      // Prepare transaction log data (aligning with user's Firestore schema for tokenTransactions)
      const transactionLog = {
        userId,
        transactionType: type,
        amount: Math.abs(amount !== 0 ? amount : escrowChange), // Log the principal amount of the transaction leg
        currency: "STAR", // Assuming STAR tokens
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        escrowBalanceBefore: currentEscrowBalance,
        escrowBalanceAfter: newEscrowBalance,
        referenceId: referenceId || null,
        description,
        status: 'completed', // Assuming direct completion; handle 'pending' if needed elsewhere
        metadata: { // Store the actual impact for clarity
            balanceImpact: amount,
            escrowImpact: escrowChange,
            initiator: initiatorId || userId,
        },
        createdAt: firestore.FieldValue.serverTimestamp(), // Firestore server timestamp
        processedAt: firestore.FieldValue.serverTimestamp(), // Or specific processing time
      };
      t.set(newTransactionRef, transactionLog);

      // Prepare wallet update data
      const walletUpdateData: { [key: string]: any } = { // Use any for flexibility with FieldValue
        balance: newBalance,
        escrowBalance: newEscrowBalance,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        lastTransactionAt: firestore.FieldValue.serverTimestamp(),
      };

      // Update cumulative fields based on the nature of the transaction amount (not escrowChange)
      if (amount > 0) { // Credits to main balance
        if (type === 'purchase') {
            walletUpdateData.totalPurchased = (walletData.totalPurchased || 0) + amount;
        } else { // earn_service_fee, admin_credit, bonus, etc.
            walletUpdateData.totalEarned = (walletData.totalEarned || 0) + amount;
        }
      } else if (amount < 0) { // Debits from main balance
        // spend_service_fee (escrow_hold is also a spend from balance), spend_project_contribution, spend_cause_donation,
        // admin_debit, payout_redeem, fee_platform
        walletUpdateData.totalSpent = (walletData.totalSpent || 0) + Math.abs(amount);
      }

      t.update(walletRef, walletUpdateData);
    });

    console.log(`Transaction ${newTransactionRef.id} for user ${userId} completed successfully.`);
    return { transactionId: newTransactionRef.id };

  } catch (error) {
    console.error(`Token transaction failed for user ${userId}:`, error);
    // Consider capturing to Sentry or other error tracking
    // admin.Sentry.captureException(error); // If Sentry is part of admin utilities
    throw error; // Re-throw to be handled by the calling route
  }
}

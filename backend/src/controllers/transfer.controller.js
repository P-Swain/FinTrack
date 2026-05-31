import { transferFunds } from "../services/transfer.service.js";

// ── POST /api/transfers ───────────────────────────────────────────────────────
export const transferFundsController = async (req, res, next) => {
  try {
    // userId always comes from the verified JWT — never from req.body
    const userId = req.user.id;

    const { from_account_id, to_account_id, amount, description, idempotency_key } =
      req.body;

    const result = await transferFunds({
      userId,
      from_account_id,
      to_account_id,
      amount,
      description,
      idempotency_key,
    });

    if (result.isDuplicate) {
      // Idempotent replay — the transfer already happened; return existing record
      return res.status(200).json({
        message: "Transfer already processed (idempotent replay)",
        transaction: result.transaction,
      });
    }

    // New successful transfer
    return res.status(201).json({
      message: "Transfer successful",
      transaction: result.transaction,
    });
  } catch (error) {
    // Forward to the global error handler in app.js which reads err.status
    next(error);
  }
};

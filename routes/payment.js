import express from "express";
import midtransClient from "midtrans-client";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// POST /api/payment/create
router.post("/create", async (req, res) => {
  try {
    const { orderId, grossAmount, customerName, email } = req.body;
    if (!orderId || !grossAmount) {
      return res.status(400).json({ message: "orderId and grossAmount are required" });
    }

    const parameter = {
      transaction_details: {
        order_id: String(orderId),
        gross_amount: Number(grossAmount),
      },
      customer_details: {
        first_name: customerName || "Guest",
        email: email || "guest@example.com",
      },
      credit_card: { secure: true },
    };

    const tx = await snap.createTransaction(parameter);
    return res.json({ token: tx.token, redirect_url: tx.redirect_url });
  } catch (err) {
    console.error("Midtrans create error:", err);
    return res.status(500).json({ message: "Midtrans error", error: String(err.message || err) });
  }
});

export default router;
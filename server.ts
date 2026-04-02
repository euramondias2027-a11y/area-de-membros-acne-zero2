import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // We need the raw body for signature verification
  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // Dummy database for purchases (replace with Firebase later)
  const userPurchases: Record<string, string[]> = {};
  const userRevocations: Record<string, string[]> = {};
  const TOKENS = {
    DETOX: "z545amw4zt4",
    MANCHAS: "vg6xr2yczss",
    PORCELANA: "2ia5hxacffc",
    RUGAS: "oqpxiz11khk",
    CELLUFIX: "qagoh0tg495",
    LIFTGLAM: "7tjmi12842f",
    ACNE: "opj8pbg172o"
  };

  const handleKiwifyWebhook = (req: any, res: any, categoryId: string, token: string) => {
    const payload = req.body;
    const signature = req.headers["x-kiwify-signature"];
    const queryToken = req.query.token;

    console.log(`Kiwify Webhook [${categoryId}] received:`, JSON.stringify(payload, null, 2));

    // Validate Signature or Token
    if (signature && token) {
      const expectedSignature = crypto
        .createHmac("sha1", token)
        .update(req.rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error(`Invalid Kiwify Signature for ${categoryId}`);
        return res.status(401).send("Invalid Signature");
      }
    } else if (queryToken !== token) {
      console.error(`Invalid or missing Kiwify Token/Signature for ${categoryId}`);
      return res.status(401).send("Unauthorized");
    }

    const { order_status, customer_email } = payload;

    // Handle Purchase Approval
    if (order_status === "paid" || order_status === "approved") {
      console.log(`Payment approved for ${customer_email} - Category: ${categoryId}`);
      
      if (!userPurchases[customer_email]) {
        userPurchases[customer_email] = [];
      }
      if (!userPurchases[customer_email].includes(categoryId)) {
        userPurchases[customer_email].push(categoryId);
        console.log(`Unlocked ${categoryId} for ${customer_email}`);
      }

      // If it was revoked before, remove it from revocations
      if (userRevocations[customer_email]) {
        userRevocations[customer_email] = userRevocations[customer_email].filter(id => id !== categoryId);
      }
    }

    // Handle Refund or Chargeback
    if (order_status === "refunded" || order_status === "chargeback") {
      console.log(`Refund/Chargeback for ${customer_email} - Category: ${categoryId}`);
      
      // Remove from purchases
      if (userPurchases[customer_email]) {
        userPurchases[customer_email] = userPurchases[customer_email].filter(id => id !== categoryId);
        console.log(`Locked ${categoryId} for ${customer_email} (removed from purchases)`);
      }

      // Add to revocations (specifically for Acne Zero)
      if (categoryId === "acne-zero") {
        if (!userRevocations[customer_email]) {
          userRevocations[customer_email] = [];
        }
        if (!userRevocations[customer_email].includes(categoryId)) {
          userRevocations[customer_email].push(categoryId);
          console.log(`Locked ${categoryId} for ${customer_email} (added to revocations)`);
        }
      }
    }

    res.status(200).send("Webhook received");
  };

  // Webhook for Detox da Pele
  app.post("/api/webhook/kiwify/detox", (req: any, res) => {
    handleKiwifyWebhook(req, res, "detox-pele", TOKENS.DETOX);
  });

  // Webhook for Pele Sem Manchas
  app.post("/api/webhook/kiwify/manchas", (req: any, res) => {
    handleKiwifyWebhook(req, res, "pele-sem-manchas", TOKENS.MANCHAS);
  });

  // Webhook for Rosto de Porcelana
  app.post("/api/webhook/kiwify/porcelana", (req: any, res) => {
    handleKiwifyWebhook(req, res, "rosto-porcelana", TOKENS.PORCELANA);
  });

  // Webhook for Rugas Off
  app.post("/api/webhook/kiwify/rugas", (req: any, res) => {
    handleKiwifyWebhook(req, res, "rugas-off", TOKENS.RUGAS);
  });

  // Webhook for CelluFix
  app.post("/api/webhook/kiwify/cellufix", (req: any, res) => {
    handleKiwifyWebhook(req, res, "cellufix", TOKENS.CELLUFIX);
  });

  // Webhook for Liftglam
  app.post("/api/webhook/kiwify/liftglam", (req: any, res) => {
    handleKiwifyWebhook(req, res, "liftglam", TOKENS.LIFTGLAM);
  });

  // Webhook for Acne Zero
  app.post("/api/webhook/kiwify/acne", (req: any, res) => {
    handleKiwifyWebhook(req, res, "acne-zero", TOKENS.ACNE);
  });

  // Legacy endpoint for backward compatibility (defaults to Detox or uses name matching)
  app.post("/api/webhook/kiwify", (req: any, res) => {
    const product_name = (req.body.product_name || "").toLowerCase();
    if (product_name.includes("manchas")) {
      handleKiwifyWebhook(req, res, "pele-sem-manchas", TOKENS.MANCHAS);
    } else if (product_name.includes("acne")) {
      handleKiwifyWebhook(req, res, "acne-zero", TOKENS.ACNE);
    } else {
      handleKiwifyWebhook(req, res, "detox-pele", TOKENS.DETOX);
    }
  });

  // Get User Purchases Endpoint
  app.get("/api/user/purchases", (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    res.json({ 
      purchasedCategories: userPurchases[email] || [],
      revokedCategories: userRevocations[email] || []
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    const detoxWebhook = `${baseUrl}/api/webhook/kiwify/detox?token=${TOKENS.DETOX}`;
    const manchasWebhook = `${baseUrl}/api/webhook/kiwify/manchas?token=${TOKENS.MANCHAS}`;
    const porcelanaWebhook = `${baseUrl}/api/webhook/kiwify/porcelana?token=${TOKENS.PORCELANA}`;
    const rugasWebhook = `${baseUrl}/api/webhook/kiwify/rugas?token=${TOKENS.RUGAS}`;
    const cellufixWebhook = `${baseUrl}/api/webhook/kiwify/cellufix?token=${TOKENS.CELLUFIX}`;
    const liftglamWebhook = `${baseUrl}/api/webhook/kiwify/liftglam?token=${TOKENS.LIFTGLAM}`;
    const acneWebhook = `${baseUrl}/api/webhook/kiwify/acne?token=${TOKENS.ACNE}`;

    console.log(`\n🚀 Kiwify Webhooks Ready:`);
    console.log(`- Acne Zero: ${acneWebhook}`);
    console.log(`- Detox da Pele: ${detoxWebhook}`);
    console.log(`- Pele Sem Manchas: ${manchasWebhook}`);
    console.log(`- Rosto de Porcelana: ${porcelanaWebhook}`);
    console.log(`- Rugas Off: ${rugasWebhook}`);
    console.log(`- CelluFix: ${cellufixWebhook}`);
    console.log(`- Liftglam: ${liftglamWebhook}\n`);
  });
}

startServer();

// middleware/verifyRequestSource.js
import crypto from "crypto";
import shopify from "../shopify.js";

/**
 * Middleware to decide if request is from:
 * - Admin (embedded app) → use validateAuthenticatedSession
 * - Storefront (app proxy) → verify HMAC
 */
export function verifyRequestSource() {
  return async (req, res, next) => {
    const hasAuthHeader = req.headers.authorization?.startsWith("Bearer ");

    if (hasAuthHeader) {
      // ✅ Admin app request (JWT token provided)
      return shopify.validateAuthenticatedSession()(req, res, next);
    }

    // ✅ Otherwise, assume Storefront Proxy → validate HMAC
    const { signature, ...rest } = req.query;
    if (!signature) {
      return res.status(401).json({ message: "Missing signature" });
    }

    const sorted = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key]}`)
      .join("");

    const calculated = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(sorted)
      .digest("hex");

    if (calculated !== signature) {
      return res.status(401).json({ message: "Invalid proxy signature" });
    }

    // ✅ Proxy request is valid
    next();
  };
}

import { DeliveryMethod } from "@shopify/shopify-api";
import { redisClient } from "../cache/redis.js";

import createZohoSalesOrder from "../zoho/orderCreation.js";
import createZohoInvoice from "../zoho/invoiceCreation.js";
import updateZohoContact from "../zoho/contactUpdate.js";
import createZohoPayment from "../zoho/paymentUpdate.js";
import { Customer } from "../../models/customer/customerModel.js";
import { createZohoContact } from "../zoho/contactCreation.js";
import { capitaliseWord } from "../zoho/utilityFunctions.js";

/**
 * @type {{[key: string]: import("@shopify/shopify-api").WebhookHandler}}
 */
export default {
  ORDERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks",

    callback: async (topic, shop, body, webhookId) => {
      
      console.log("````````order webhook triggered````````");

      const shopifyOrder = JSON.parse(body);

      try {

        // WEBHOOK-LEVEL IDEMPOTENCY (ATOMIC)

        const webhookLock = await redisClient.set(
          `shopify:webhook:${webhookId}`,
          "1",
          { NX: true, EX: 600 }
        );

        if (!webhookLock) {
          console.log("Duplicate webhook ignored:", webhookId);
          return;
        }

        // ORDER-LEVEL IDEMPOTENCY (ATOMIC)

        const orderKey = `shopify:order:${shopifyOrder.id}`;

        const orderLock = await redisClient.set(
          orderKey,
          "processing",
          { NX: true, EX: 1800 }
        );

        if (!orderLock) {
          console.log("Order already being processed:", shopifyOrder.name);
          return;
        }

        // CUSTOMER HANDLING (SAFE)

        const email = shopifyOrder.email || shopifyOrder.customer?.email;
        if (!email) {
          throw new Error("Order has no email");
        }

        let customer = await Customer.findOne({ email });

        let zohoCustomerId = customer?.customer_id || null;

        if (!zohoCustomerId) {
          const contact = {
            shop,
            first_name: shopifyOrder.billing_address.first_name,
            last_name: shopifyOrder.billing_address.last_name,
            email,
            phone:
              shopifyOrder.phone ||
              shopifyOrder.shipping_address?.phone ||
              shopifyOrder.billing_address?.phone,
            address: shopifyOrder.billing_address.address1,
            street2: shopifyOrder.billing_address.address2,
            city: shopifyOrder.billing_address.city,
            state: shopifyOrder.billing_address.province,
            state_code: shopifyOrder.billing_address.province_code,
            zip: shopifyOrder.billing_address.zip,
            country: shopifyOrder.billing_address.country,
            country_code: shopifyOrder.billing_address.country_code,
            gst_number: ""
          };

          const response = await createZohoContact(contact);

          if (response?.message !== "The contact has been added.") {
            throw new Error("Zoho contact creation failed");
          }

          // atomic upsert for customer
          customer = await Customer.findOneAndUpdate(
            { email },
            {
              $setOnInsert: {
                ...contact,
                gstStatus: false,
                customer_id: response.contact.contact_id
              }
            },
            { upsert: true, new: true }
          );

          zohoCustomerId = customer.customer_id;
        } else {
          // update shipping address safely
          await updateZohoContact(
            {
              contact_name: `${capitaliseWord(customer.first_name)} ${capitaliseWord(customer.last_name || "")}`.trim(),
              shipping_address: {
                attention: `${capitaliseWord(shopifyOrder.billing_address.first_name)} ${capitaliseWord(shopifyOrder.billing_address.last_name || "")}`.trim(),
                address: shopifyOrder.billing_address.address1 || "",
                street2: shopifyOrder.billing_address.address2 || "",
                city: shopifyOrder.billing_address.city || "",
                state: shopifyOrder.billing_address.province || "",
                zip: shopifyOrder.billing_address.zip || "",
                country: shopifyOrder.billing_address.country || "",
                phone:
                  shopifyOrder.phone ||
                  shopifyOrder.shipping_address?.phone ||
                  shopifyOrder.billing_address?.phone ||
                  customer.phone
              }
            },
            zohoCustomerId
          );
        }

        // SALES ORDER + INVOICE (ONCE)

        const soResponse = await createZohoSalesOrder(
          shopifyOrder,
          zohoCustomerId
        );

        const invoiceDetails = await createZohoInvoice(
          soResponse.salesorder
        );

        // PAYMENT (ONLY IF PAID)

        if (
          shopifyOrder.financial_status === "paid" &&
          invoiceDetails?.invoice_id
        ) {
          const amount = Number(shopifyOrder.total_price);
          const date = (
            shopifyOrder.processed_at || shopifyOrder.created_at
          ).split("T")[0];

          await createZohoPayment(
            invoiceDetails.invoice_id,
            invoiceDetails.customer_id,
            amount,
            date
          );

          console.log("Payment synced:", shopifyOrder.name);
        } else {
          console.log("Order unpaid → invoice left open:", shopifyOrder.name);
        }

        // MARK ORDER AS DONE (FINAL LOCK)

        await redisClient.set(
          orderKey,
          "done",
          { EX: 86400 } // keep 24 hours
        );

      } catch (err) {
        console.error("Webhook processing failed:", err);

        // allow retry if something failed
        await redisClient.del(`shopify:order:${shopifyOrder.id}`);
      }
    }
  }
};

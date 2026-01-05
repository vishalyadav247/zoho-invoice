import axios from "axios";
import { getZohoAccessToken } from "./utilityFunctions.js";
const orgId = process.env.ZOHO_ORG_ID;

export default async function createZohoPayment(invoiceId, customerId, amount, date) {
    const accessToken = await getZohoAccessToken();

    const payload = {
        customer_id: customerId,
        payment_mode: "Online",
        amount: amount,
        date: date,
        invoices: [
            {
                invoice_id: invoiceId,
                amount_applied: amount
            }
        ]
    };

    const response = await axios.post(
        `https://www.zohoapis.in/inventory/v1/customerpayments?organization_id=${orgId}`,
        payload,
        {
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                "Content-Type": "application/json"
            }
        }
    );

    console.log("Zoho Payment Applied:", response.data.message);
    return response.data;
}

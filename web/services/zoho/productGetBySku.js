/**
 * Fetches Zoho item_id by SKU
 * @param {string} sku
 * @param {string} accessToken
 * @returns {string|null}
 */
import axios from "axios";

export async function getZohoItemIdBySku(sku, accessToken) {
    try {
        const response = await axios.get(
            `https://www.zohoapis.in/inventory/v1/items`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    organization_id: process.env.ZOHO_ORG_ID,
                    sku: sku
                },
                validateStatus: () => true,
            }
        );

        if (response.data.code !== 0) {
            console.error("Error fetching Zoho item by SKU:", response.data.message);
            return null;
        }

        const items = response.data.items;
        if (!items || items.length === 0) {
            console.log("No Zoho item found with SKU:", sku);
            return null;
        }

        return items[0].item_id;
    } catch (error) {
        console.error("Error in getZohoItemIdBySku:", error);
        if (error.response) console.error("Response data:", error.response.data);
        return null;
    }
}
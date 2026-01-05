import axios from 'axios';
import { getZohoAccessToken } from "./utilityFunctions.js";

export default async function updateZohoContact(payload, customer_id) {

    let accessToken = await getZohoAccessToken();

    try {
        let response = await axios.put(`https://www.zohoapis.in/inventory/v1/contacts/${customer_id}?organization_id=${process.env.ZOHO_ORG_ID}`,
            payload,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        )
        if (response.status === 200) {
            console.log(response.data.message)
            return response.data.message;
        } else {
            console.error("Error updating Zoho contact:", response.data.message);
            return response.data.message;
        }

    } catch (error) {
        console.log('error in updating shipping address', error)
    }
}

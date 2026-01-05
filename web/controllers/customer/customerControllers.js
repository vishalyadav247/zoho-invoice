import { Customer } from '../../models/customer/customerModel.js';
import { createZohoContact } from '../../services/zoho/contactCreation.js';
import updateZohoContact from '../../services/zoho/contactUpdate.js';
import { capitaliseWord } from '../../services/zoho/utilityFunctions.js';

// Create a new customer
export const createCustomer = async (req, res) => {

  const contact = req.body;

  try {

    const existingContact = await Customer.findOne({ email: contact.email })

    if (!existingContact) {
      const response = await createZohoContact(contact);
      if (response.message === 'The contact has been added.') {
        const aditionProperties = {
          gstStatus: contact.gst_number ? true : false,
          customer_id: response.contact.contact_id
        }
        const newCustomer = new Customer({ ...contact, ...aditionProperties });
        await newCustomer.save();
        return res.status(201).json({ message: response.message, customer: newCustomer });
      }
    } else {

      if (existingContact.gstStatus) {
        return res.status(400).json({ message: `Customer with ${contact.email} is already exists.` })
      }
      // update contact
      const address = {
        "attention": `${capitaliseWord(contact.first_name)} ${capitaliseWord(contact.last_name) || ""}`.trim(),
        "address": contact.address || "",
        "street2": contact.street2 || "",
        "city": contact.city || "",
        "state": contact.state || "",
        "zip": contact.zip || "",
        "country": contact.country || "",
        "phone": contact.phone || ""
      }

      const payload = {
        "contact_name": `${capitaliseWord(contact.first_name)} ${capitaliseWord(contact.last_name) || ""}`.trim(),
        "company_name": `${capitaliseWord(contact.first_name)} ${capitaliseWord(contact.last_name) || ""}`.trim(),
        "currency_id": "2491591000000000064",
        "email": contact.email || "",
        "phone": contact.phone || "",
        "contact_type": "customer",
        "customer_sub_type": "business",
        "billing_address": address,
        "shipping_address": address,
        "contact_persons": [
          {
            "salutation": "",
            "first_name": capitaliseWord(contact.first_name),
            "last_name": capitaliseWord(contact.last_name) || "",
            "email": contact.email || "",
            "mobile": contact.phone || "",
            "is_primary_contact": true,
          }
        ],
        "language_code": "en",
        "country_code": contact.country_code || "",
        "place_of_contact": contact.state_code || "",
        "gst_no": contact.gst_number || "",
        "gst_treatment": contact.gst_number ? "business_gst" : "consumer",
      }
      
      const response = await updateZohoContact(payload, existingContact.customer_id)
      if (response === 'Contact information has been saved.') {
        const updateCustomer = await Customer.findOneAndUpdate(
          { email: existingContact.email },
          {
            $set: {
              first_name: capitaliseWord(contact.first_name),
              last_name:"",
              phone: contact.phone,
              address: contact.address,
              city: contact.city,
              state: contact.state,
              country: contact.country,
              zip: contact.zip,
              gst_number: contact.gst_number,
              gstStatus: contact.gst_number ? true : false
            }
          }
        )
        return res.status(201).json({ message: 'The contact has been added.', customer: updateCustomer });
      }
    }
  } catch (error) {
    console.log(error)
    res.status(400).json({ message: 'error in creating contact' });
  }
};

// Get all customers
export const getAllCustomers = async (req, res) => {
  try {
    const { shop } = req.query;
    const filter = shop ? { shop } : {};
    const customers = await Customer.find(filter).sort({ _id: -1 })
    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
};

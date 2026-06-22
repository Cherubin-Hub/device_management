// Default email templates are used until administrators save custom text in Email Configuration.
export const emailTemplateTypes = [
  { key: "registerDevice", name: "Register Device" },
  { key: "unregisterDevice", name: "Unregister Device" },
];

export const defaultEmailTemplates = {
  registerDevice: {
    template_key: "registerDevice",
    name: "Register Device",
    to_email: "",
    cc_email: "",
    subject: "Register Device - #SN",
    body: "Hi,\n\nPlease register device #SN.\n\nDevice Type: #DEVICE_TYPE\nCST Number: #CST\nTicket Number: #TICKET\n\nThank you.",
  },
  unregisterDevice: {
    template_key: "unregisterDevice",
    name: "Unregister Device",
    to_email: "",
    cc_email: "",
    subject: "Unregister Device - #SN",
    body: "Hi,\n\nPlease unregister device #SN.\n\nDevice Type: #DEVICE_TYPE\nCST Number: #CST\nTicket Number: #TICKET\n\nThank you.",
  },
};

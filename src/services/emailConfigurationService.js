import { defaultEmailTemplates, emailTemplateTypes } from "../lib/emailTemplates.js";
import { supabase } from "../lib/supabase.js";

export async function fetchEmailConfigurations() {
  const { data, error } = await supabase
    .from("email_configurations")
    .select("id, template_key, name, to_email, cc_email, subject, body")
    .in("template_key", emailTemplateTypes.map((item) => item.key));

  if (error) {
    throw error;
  }

  return mergeEmailTemplates(data || []);
}

export async function saveEmailConfiguration(templateKey, value) {
  const templateType = emailTemplateTypes.find((item) => item.key === templateKey);
  const previousTemplate = defaultEmailTemplates[templateKey];
  const payload = {
    template_key: templateKey,
    name: templateType?.name || previousTemplate.name,
    to_email: value.toEmail.trim(),
    cc_email: value.ccEmail.trim(),
    subject: value.subject.trim(),
    body: value.body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("email_configurations")
    .upsert(payload, { onConflict: "template_key" })
    .select("id, template_key, name, to_email, cc_email, subject, body")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function mergeEmailTemplates(rows) {
  const mergedTemplates = { ...defaultEmailTemplates };
  rows.forEach((item) => {
    mergedTemplates[item.template_key] = {
      ...mergedTemplates[item.template_key],
      ...item,
    };
  });
  return mergedTemplates;
}

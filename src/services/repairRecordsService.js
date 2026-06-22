import { emailTemplateTypes } from "../lib/emailTemplates.js";
import { supabase } from "../lib/supabase.js";

const repairRecordSelect = "*, clients ( id, name, client_code ), statuses ( id, name, color )";

export async function fetchRepairRecordsData() {
  const [devicesResult, statusesResult, clientsResult, deviceTypesResult, emailTemplatesResult] = await Promise.all([
    supabase
      .from("device_inventory_items")
      .select(`
        id,
        company,
        client_id,
        raised_by,
        date_received,
        package_style,
        cst_number,
        ticket_number,
        sn_number,
        device_type,
        with_adapter,
        start_repairing_support,
        end_date_support,
        start_qa,
        end_date_qa,
        status_id,
        date_delivered,
        give_to,
        remarks,
        clients ( id, name, client_code ),
        statuses ( id, name, color )
      `)
      .order("date_received", { ascending: false }),
    supabase
      .from("statuses")
      .select("id, name, color, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("clients")
      .select("id, name, client_code, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("device_types")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("email_configurations")
      .select("id, template_key, name, to_email, cc_email, subject, body")
      .in("template_key", emailTemplateTypes.map((item) => item.key)),
  ]);

  const primaryError = devicesResult.error || statusesResult.error || clientsResult.error || deviceTypesResult.error;
  if (primaryError) {
    throw primaryError;
  }

  return {
    clients: clientsResult.data || [],
    deviceTypes: deviceTypesResult.data || [],
    emailTemplates: emailTemplatesResult.error ? [] : emailTemplatesResult.data || [],
    records: devicesResult.data || [],
    statuses: statusesResult.data || [],
  };
}

export async function insertRepairRecord(payload) {
  const { data, error } = await supabase
    .from("device_inventory_items")
    .insert(payload)
    .select(repairRecordSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRepairRecord(id, payload) {
  const { data, error } = await supabase
    .from("device_inventory_items")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(repairRecordSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteRepairRecord(id) {
  const { error } = await supabase
    .from("device_inventory_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

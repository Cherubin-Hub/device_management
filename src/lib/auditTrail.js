// Import the shared Supabase client used by all database helpers.
import { supabase } from "./supabase.js";

// Write one audit movement record after a successful user workflow.
export async function logAuditEvent({
  action, // Describes what happened, for example CREATE, UPDATE, DELETE, or TRANSFER.
  afterData = null, // Stores the record state after the action when available.
  beforeData = null, // Stores the record state before the action when available.
  entityId = null, // Stores the affected record id as a flexible value.
  entityTable, // Stores the table affected by the movement.
  metadata = null, // Stores extra movement details such as source record ids.
  module, // Stores the application module that created the event.
  recordLabel = "", // Stores the readable label shown in the Audit Trail table.
  summary = "", // Stores the readable action summary shown to users.
}) {
  if (!supabase) {
    // Stop safely when Supabase environment variables are missing.
    return { error: new Error("Supabase not configured") };
  }

  try {
    // Capture the signed-in user so audit records identify who performed each movement.
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    // Write audit entries after successful workflows without changing the original operation payload.
    const { error } = await supabase.from("audit_trail").insert({
      action, // Save the action type for filtering and reporting.
      actor_email: user?.email || null, // Save the user email when Supabase Auth provides it.
      actor_id: user?.id || null, // Save the user id when Supabase Auth provides it.
      after_data: afterData, // Save the post-change snapshot.
      before_data: beforeData, // Save the pre-change snapshot.
      entity_id: entityId ? String(entityId) : null, // Convert ids to text because source tables can vary.
      entity_table: entityTable, // Save the source/target table name.
      metadata, // Save optional extra details for future troubleshooting.
      module, // Save the module name shown in the report.
      record_label: recordLabel || "Untitled record", // Always provide a readable fallback label.
      summary, // Save the user-facing movement summary.
    });

    if (error) {
      // Keep audit logging non-blocking so inventory workflows continue if the table is not deployed yet.
      console.warn("Audit trail logging failed:", error.message);
    }

    // Return the Supabase error object so callers may inspect it if needed.
    return { error };
  } catch (error) {
    // Catch unexpected runtime errors such as network failures.
    console.warn("Audit trail logging failed:", error.message);
    // Return the caught error in the same shape as Supabase responses.
    return { error };
  }
}

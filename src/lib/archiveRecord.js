// Archive helpers copy records into archived_records before the source row is deleted.
import { supabase } from "./supabase.js";

export async function archiveRecord({ recordData, recordLabel, recordType, sourceTable }) {
  if (!supabase) {
    // Return an error instead of throwing so pages can show a normal UI message.
    return { error: new Error("Supabase not configured") };
  }

  // Save the full record payload before deletion so the user can restore it later.
  return supabase.from("archived_records").insert({
    record_data: recordData,
    record_label: recordLabel || "Untitled record",
    record_type: recordType,
    source_table: sourceTable,
  });
}

// src/features/trials/types.ts
// Summary: Shared TypeScript types for trial (deneme) lead pipeline entities used in UI and API.
// Integrations:
// - Mirrors public.trials lead pipeline fields (status/lost/converted) + soft delete deleted_at.
//
// v2.0 (lead pipeline):
// - Adds pipeline fields:
//   - status: 'active' | 'converted' | 'lost'
//   - lost_at / lost_reason
//   - converted_patient_id
// - Keeps optional deleted_at for backward compatible UI rollouts.

export type TrialStatus = 'active' | 'converted' | 'lost';

export type TrialRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  first_meet_at: string | null;
  next_meet_at: string | null;
  created_at: string;
  reference_id: string | null;
  note: string | null;

  // Lead pipeline
  status: TrialStatus;
  lost_at: string | null;
  lost_reason: string | null;
  converted_patient_id: string | null;

  /**
   * Soft delete timestamp (timestamptz).
   * When present, the row is considered deleted.
   * Optional for backward compatibility while DB/view rollout completes.
   */
  deleted_at?: string | null;
};

/**
 * One device line used in a trial offer.
 * Each row corresponds to a row in trial_devices on the backend.
 */
export type TrialDeviceFormRow = {
  rowKey: string; // local UI key, not persisted
  side: string; // 'both' | 'left' | 'right' | ''
  brand: string; // brand text
  model: string; // model text
  listPrice: string; // suggested list price (auto from catalog view, toplam)
  quotePrice: string; // user-entered total offer for this device row
};

export type NewTrialForm = {
  // Patient-facing fields
  fullName: string;
  phone: string;
  firstMeetAt: string; // datetime-local string, can be empty
  nextMeetAt: string; // datetime-local string, can be empty

  // Optional reference link (who sent this trial)
  referenceId?: string | null;
  referenceName?: string;

  // Optional internal note about this trial
  note: string;

  // Device lines for this trial
  devices: TrialDeviceFormRow[];
};

/**
 * Current device model price row as exposed by the
 * current_device_catalog_prices_public view.
 */
export type DeviceModelPriceRow = {
  id: string;
  brand: string;
  model: string;
  list_price: number;
};

/**
 * trial_devices row enriched with catalog data via
 * trial_devices_with_catalog_public view.
 */
export type TrialDeviceRow = {
  id: string;
  side: string | null;
  brand: string | null;
  model: string | null;
  quote_price: number | null;

  // From current_device_model_prices_public (via view)
  list_price?: number | null;
  purchase_price?: number | null;
  item_type?: string | null;
  battery_type?: string | null;
  details?: unknown | null;
  notes?: string | null;
};

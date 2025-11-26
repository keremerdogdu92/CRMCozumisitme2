// src/features/trials/types.ts
// Shared TypeScript types for trial (deneme) entities used in UI and API.

export type TrialRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  first_meet_at: string | null;
  next_meet_at: string | null;
  created_at: string;
  reference_id: string | null;
};

/**
 * One device line used in a trial offer.
 * Each row corresponds to a row in trial_devices on the backend.
 */
export type TrialDeviceFormRow = {
  rowKey: string;      // local UI key, not persisted
  side: string;        // 'both' | 'left' | 'right' | ''
  brand: string;       // brand text
  model: string;       // model text
  listPrice: string;   // suggested list price (auto from catalog view, toplam)
  quotePrice: string;  // user-entered total offer for this device row
};

export type NewTrialForm = {
  // Patient-facing fields
  fullName: string;
  phone: string;
  firstMeetAt: string; // datetime-local string, can be empty
  nextMeetAt: string;  // datetime-local string, can be empty

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
 * trial_devices table row used in detail drawer + print sheet.
 */
export type TrialDeviceRow = {
  id: string;
  side: string | null;
  brand: string | null;
  model: string | null;
  quote_price: number | null;
};

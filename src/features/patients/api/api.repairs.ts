// src/features/patients/api/api.repairs.ts
// Device repair tracking helpers for patients feature.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';
import type { DeviceRepairRow, DeviceRepairStatus } from '../types';
import { PATIENT_DEVICES_BY_PATIENT_QUERY_KEY } from './api.devices';

export const DEVICE_REPAIRS_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['device-repairs', patientId] as const;

export type DeviceRepairsActiveSummary = {
  total: number;
  byStatus: Record<DeviceRepairStatus, number>;
  oldestOpen?: string | null;
};

export async function fetchDeviceRepairsByPatientId(
  patientId: string,
): Promise<DeviceRepairRow[]> {
  if (!patientId) return [];

  const { data, error } = await supabaseClient
    .from('device_repairs')
    .select('*')
    .eq('patient_id', patientId)
    .order('last_status_changed', { ascending: false });

  if (error) {
    console.error('Supabase fetchDeviceRepairsByPatientId error:', error);
    throw error;
  }

  return (data ?? []).map((row: any): DeviceRepairRow => ({
    id: row.id as string,
    org_id: row.org_id as string,
    patient_id: (row.patient_id as string | null) ?? null,
    inventory_item_id: (row.inventory_item_id as string | null) ?? null,
    status: row.status as DeviceRepairStatus,
    reason_note: (row.reason_note as string | null) ?? null,
    cargo_company: (row.cargo_company as string | null) ?? null,
    cargo_tracking_no: (row.cargo_tracking_no as string | null) ?? null,
    shipped_at: (row.shipped_at as string | null) ?? null,
    returned_to_clinic_at: (row.returned_to_clinic_at as string | null) ?? null,
    delivered_to_patient_at: (row.delivered_to_patient_at as string | null) ?? null,
    expected_delivery_meeting_id:
      (row.expected_delivery_meeting_id as string | null) ?? null,
    last_status_changed: row.last_status_changed as string,
    cost: row.cost === null ? null : Number(row.cost),
    note: (row.note as string | null) ?? null,
  }));
}

export function useDeviceRepairs(patientId: string | null) {
  return useQuery({
    queryKey: patientId
      ? DEVICE_REPAIRS_BY_PATIENT_QUERY_KEY(patientId)
      : ['device-repairs', 'none'],
    enabled: !!patientId,
    queryFn: () => fetchDeviceRepairsByPatientId(patientId as string),
  });
}

export type CreateDeviceRepairInput = {
  orgId: string;
  patientId: string;
  inventoryItemId: string;
  reasonNote: string;
  cargoCompany?: string;
  cargoTrackingNo?: string;
  shipImmediately?: boolean;
};

export async function createDeviceRepairForInventoryItem(
  input: CreateDeviceRepairInput,
): Promise<DeviceRepairRow> {
  const {
    orgId,
    patientId,
    inventoryItemId,
    reasonNote,
    cargoCompany,
    cargoTrackingNo,
    shipImmediately,
  } = input;

  const status: DeviceRepairStatus = shipImmediately ? 'shipped' : 'created';
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from('device_repairs')
    .insert({
      org_id: orgId,
      patient_id: patientId,
      inventory_item_id: inventoryItemId,
      reason_note: reasonNote,
      cargo_company: cargoCompany ?? null,
      cargo_tracking_no: cargoTrackingNo ?? null,
      status,
      shipped_at: shipImmediately ? nowIso : null,
      last_status_changed: nowIso,
    })
    .select('*')
    .single();

  if (error) {
    console.error('createDeviceRepairForInventoryItem insert error:', error);
    throw error;
  }

  const { error: updateError } = await supabaseClient
    .from('inventory_items')
    .update({ status: 'repair' })
    .eq('id', inventoryItemId);

  if (updateError) {
    console.error(
      'createDeviceRepairForInventoryItem inventory update error:',
      updateError,
    );
  }

  return {
    id: data.id as string,
    org_id: data.org_id as string,
    patient_id: (data.patient_id as string | null) ?? null,
    inventory_item_id: (data.inventory_item_id as string | null) ?? null,
    status: data.status as DeviceRepairStatus,
    reason_note: (data.reason_note as string | null) ?? null,
    cargo_company: (data.cargo_company as string | null) ?? null,
    cargo_tracking_no: (data.cargo_tracking_no as string | null) ?? null,
    shipped_at: (data.shipped_at as string | null) ?? null,
    returned_to_clinic_at: (data.returned_to_clinic_at as string | null) ?? null,
    delivered_to_patient_at: (data.delivered_to_patient_at as string | null) ?? null,
    expected_delivery_meeting_id:
      (data.expected_delivery_meeting_id as string | null) ?? null,
    last_status_changed: data.last_status_changed as string,
    cost: data.cost === null ? null : Number(data.cost),
    note: (data.note as string | null) ?? null,
  };
}

export type UpdateDeviceRepairStatusInput = {
  repairId: string;
  nextStatus: DeviceRepairStatus;
  meetingIdForDelivery?: string | null;
};

export async function updateDeviceRepairStatus(
  input: UpdateDeviceRepairStatusInput,
): Promise<DeviceRepairRow> {
  const { repairId, nextStatus, meetingIdForDelivery } = input;

  const nowIso = new Date().toISOString();
  const updatePatch: Record<string, any> = {
    status: nextStatus,
    last_status_changed: nowIso,
  };

  if (nextStatus === 'shipped') {
    updatePatch.shipped_at = nowIso;
  }
  if (nextStatus === 'returned_waiting_meeting') {
    updatePatch.returned_to_clinic_at = nowIso;
  }
  if (nextStatus === 'scheduled') {
    updatePatch.expected_delivery_meeting_id = meetingIdForDelivery ?? null;
  }
  if (nextStatus === 'delivered') {
    updatePatch.delivered_to_patient_at = nowIso;
    updatePatch.expected_delivery_meeting_id = meetingIdForDelivery ?? null;
  }
  if (nextStatus === 'cancelled') {
    updatePatch.expected_delivery_meeting_id = null;
  }

  const { data, error } = await supabaseClient
    .from('device_repairs')
    .update(updatePatch)
    .eq('id', repairId)
    .select('*')
    .single();

  if (error) {
    console.error('updateDeviceRepairStatus update error:', error);
    throw error;
  }

  // Inventory status adjustments on completion/cancel.
  if (nextStatus === 'delivered' || nextStatus === 'cancelled') {
    if (data.inventory_item_id) {
      const { error: invErr } = await supabaseClient
        .from('inventory_items')
        .update({ status: 'sold' })
        .eq('id', data.inventory_item_id);
      if (invErr) {
        console.error('updateDeviceRepairStatus inventory update error:', invErr);
      }
    }
  }

  return {
    id: data.id as string,
    org_id: data.org_id as string,
    patient_id: (data.patient_id as string | null) ?? null,
    inventory_item_id: (data.inventory_item_id as string | null) ?? null,
    status: data.status as DeviceRepairStatus,
    reason_note: (data.reason_note as string | null) ?? null,
    cargo_company: (data.cargo_company as string | null) ?? null,
    cargo_tracking_no: (data.cargo_tracking_no as string | null) ?? null,
    shipped_at: (data.shipped_at as string | null) ?? null,
    returned_to_clinic_at: (data.returned_to_clinic_at as string | null) ?? null,
    delivered_to_patient_at: (data.delivered_to_patient_at as string | null) ?? null,
    expected_delivery_meeting_id:
      (data.expected_delivery_meeting_id as string | null) ?? null,
    last_status_changed: data.last_status_changed as string,
    cost: data.cost === null ? null : Number(data.cost),
    note: (data.note as string | null) ?? null,
  };
}

export async function fetchActiveDeviceRepairsSummary(
  orgId: string,
): Promise<DeviceRepairsActiveSummary> {
  if (!orgId) return { total: 0, byStatus: {}, oldestOpen: null };

  const { data, error } = await supabaseClient
    .from('device_repairs')
    .select('status, last_status_changed')
    .eq('org_id', orgId)
    .in('status', [
      'created',
      'shipped',
      'returned_waiting_meeting',
      'scheduled',
    ]);

  if (error) {
    console.error('fetchActiveDeviceRepairsSummary error:', error);
    throw error;
  }

  const byStatus: Record<DeviceRepairStatus, number> = {
    created: 0,
    shipped: 0,
    returned_waiting_meeting: 0,
    scheduled: 0,
    delivered: 0,
    cancelled: 0,
  };

  let oldestOpen: string | null = null;

  (data ?? []).forEach((row: any) => {
    const status = row.status as DeviceRepairStatus;
    if (byStatus[status] != null) {
      byStatus[status] += 1;
    }
    const ts = row.last_status_changed as string | null;
    if (ts) {
      if (!oldestOpen || new Date(ts).getTime() < new Date(oldestOpen).getTime()) {
        oldestOpen = ts;
      }
    }
  });

  const total = Object.entries(byStatus)
    .filter(([k]) =>
      ['created', 'shipped', 'returned_waiting_meeting', 'scheduled'].includes(
        k,
      ),
    )
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    total,
    byStatus,
    oldestOpen,
  };
}

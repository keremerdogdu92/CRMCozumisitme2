// src/features/patients/patientFormatUtils.ts
// Shared formatting helpers for patient-related views.

export function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

export function formatDateTime(value: string | null): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    return (
      d.toLocaleDateString('tr-TR') +
      ' ' +
      d.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  } catch {
    return '-';
  }
}

export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  return (
    amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' ₺'
  );
}

export function addMonths(dateStr: string, count: number): string {
  try {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + count);
    return d.toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

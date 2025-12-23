// src/pages/MeetingsPage.tsx
// Meetings overview page: new-meeting form + meetings table.
//
// Patch v1.1: No functional change; kept for completeness.

import { MeetingNewFormCard } from '../features/meetings/MeetingNewFormCard';
import { MeetingsTable } from '../features/meetings/MeetingsTable';

export default function MeetingsPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Görüşmeler</h1>
        <p className="text-sm text-slate-500">
          Hastalar, deneme hastaları ve referanslarla yapılan görüşmeleri kaydedin.
        </p>
      </div>

      <MeetingNewFormCard />

      <div className="mt-2">
        <MeetingsTable />
      </div>
    </div>
  );
}

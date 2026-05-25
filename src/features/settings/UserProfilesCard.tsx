import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { useCurrentProfile } from '../auth/useCurrentProfile';

type ProfileRow = {
  id: string;
  role: 'admin' | 'staff' | 'unknown';
  display_name: string | null;
  created_at: string | null;
};

const USER_PROFILES_QUERY_KEY = ['settings-user-profiles'] as const;

function roleLabel(role: ProfileRow['role']): string {
  if (role === 'admin') return 'Admin';
  if (role === 'staff') return 'Personel';
  return 'Bilinmiyor';
}

async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, role, display_name, created_at')
    .order('role', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error('PROFILE_LIST: ' + error.message);

  return ((data ?? []) as Array<{
    id: string;
    role: string | null;
    display_name: string | null;
    created_at: string | null;
  }>).map((row) => ({
    id: row.id,
    role: row.role === 'admin' || row.role === 'staff' ? row.role : 'unknown',
    display_name: row.display_name ?? null,
    created_at: row.created_at ?? null,
  }));
}

async function updateProfileDisplayName(input: {
  id: string;
  displayName: string;
}): Promise<void> {
  const { error } = await supabaseClient
    .from('profiles')
    .update({ display_name: input.displayName.trim() || null })
    .eq('id', input.id);

  if (error) throw new Error('PROFILE_UPDATE: ' + error.message);
}

export function UserProfilesCard() {
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const { data: profiles, isLoading, isError, error } = useQuery({
    queryKey: USER_PROFILES_QUERY_KEY,
    queryFn: fetchProfiles,
  });

  const [names, setNames] = useState<Record<string, string>>({});
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    const next: Record<string, string> = {};
    (profiles ?? []).forEach((row) => {
      next[row.id] = row.display_name ?? '';
    });
    setNames(next);
  }, [profiles]);

  const mutation = useMutation({
    mutationFn: updateProfileDisplayName,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USER_PROFILES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ['current-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['assignable-profiles'] });
    },
  });

  const rows = useMemo(() => profiles ?? [], [profiles]);

  return (
    <section className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Kullanici gorunen adlari
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Gorevlerde atanacak kisiler e-posta yerine bu adlarla gorunur. Admin
          organizasyondaki herkesin adini, personel yalnizca kendi adini
          duzenleyebilir.
        </p>
      </div>

      {isLoading && (
        <p className="text-xs text-slate-500">Kullanicilar yukleniyor...</p>
      )}

      {isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {(error as Error)?.message ?? 'Kullanicilar yuklenemedi.'}
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className="text-xs text-slate-500">Kayitli kullanici bulunamadi.</p>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const canEdit = isAdmin || row.id === profile?.id;
            const fallback = `${roleLabel(row.role)} ${index + 1}`;
            const value = names[row.id] ?? '';

            return (
              <div
                key={row.id}
                className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-[1fr_160px_auto]"
              >
                <label className="space-y-1">
                  <span className="font-medium text-slate-700">
                    Gorunen ad
                  </span>
                  <input
                    type="text"
                    value={value}
                    placeholder={fallback}
                    disabled={!canEdit || mutation.isPending}
                    onChange={(event) =>
                      setNames((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </label>

                <div className="space-y-1">
                  <span className="block font-medium text-slate-700">Rol</span>
                  <span className="inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                    {roleLabel(row.role)}
                  </span>
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    disabled={!canEdit || mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        id: row.id,
                        displayName: value,
                      })
                    }
                    className="rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            );
          })}

          {mutation.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {(mutation.error as Error).message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

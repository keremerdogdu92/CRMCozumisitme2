import type { SupabaseClient } from '@supabase/supabase-js';

type ApiRequestWithHeaders = {
  headers?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => {
    json: (body: any) => void;
  };
};

type ProfileRow = {
  id: string;
  org_id: string | null;
  role: string | null;
};

export type ImportApiUser = {
  id: string;
  orgId: string;
  role: 'admin' | 'staff';
};

export class ApiHttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function readHeader(
  req: ApiRequestWithHeaders,
  name: string,
): string | undefined {
  const headers = req.headers ?? {};
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function getBearerToken(req: ApiRequestWithHeaders): string {
  const header = readHeader(req, 'authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new ApiHttpError(
      401,
      'AUTH_TOKEN_MISSING',
      'Authorization Bearer token is required.',
    );
  }
  return match[1].trim();
}

export function sendApiError(res: ApiResponse, err: unknown): void {
  if (err instanceof ApiHttpError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  res.status(500).json({
    error: err instanceof Error ? err.message : 'Unhandled server error.',
    code: 'INTERNAL_ERROR',
  });
}

export async function requireImportApiUser(
  req: ApiRequestWithHeaders,
  supabase: SupabaseClient,
): Promise<ImportApiUser> {
  const token = getBearerToken(req);
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !authData.user) {
    throw new ApiHttpError(
      401,
      'AUTH_TOKEN_INVALID',
      'Invalid or expired Supabase access token.',
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new ApiHttpError(
      500,
      'PROFILE_LOOKUP_FAILED',
      'Failed to load authenticated user profile.',
    );
  }

  const row = profile as ProfileRow | null;
  if (!row?.org_id) {
    throw new ApiHttpError(
      403,
      'PROFILE_ORG_MISSING',
      'Authenticated user profile is not assigned to an organization.',
    );
  }

  if (row.role !== 'admin' && row.role !== 'staff') {
    throw new ApiHttpError(
      403,
      'ROLE_NOT_ALLOWED',
      'Only admin and staff users can run import operations.',
    );
  }

  return {
    id: authData.user.id,
    orgId: row.org_id,
    role: row.role,
  };
}

export function assertSameOrg(
  user: ImportApiUser,
  orgId: string | null | undefined,
  resourceName: string,
): void {
  if (!orgId || orgId !== user.orgId) {
    throw new ApiHttpError(
      403,
      'ORG_FORBIDDEN',
      `${resourceName} does not belong to the authenticated user's organization.`,
    );
  }
}

export async function assertImportJobOrg(
  supabase: SupabaseClient,
  jobId: string,
  user: ImportApiUser,
): Promise<void> {
  const { data, error } = await supabase
    .from('import_jobs')
    .select('id, org_id')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw new ApiHttpError(
      500,
      'IMPORT_JOB_LOOKUP_FAILED',
      'Failed to load import job for authorization.',
    );
  }

  if (!data) {
    throw new ApiHttpError(404, 'IMPORT_JOB_NOT_FOUND', 'Import job not found.');
  }

  assertSameOrg(user, (data as { org_id: string | null }).org_id, 'Import job');
}

import type { ZodTypeAny } from 'zod';
import { flattenIssues } from '../../shared/schema';

export type Errors = Record<string, string>;
export function validate(schema: ZodTypeAny, data: unknown, prefix: string): Errors {
  const r = schema.safeParse(data);
  return r.success ? {} : flattenIssues(r.error.issues, prefix);
}

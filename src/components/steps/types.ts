import type { Draft } from '../../lib/draft';
import type { Errors } from '../../lib/validate';

export interface StepProps {
  draft: Draft;
  errors: Errors;
  update: (fn: (d: Draft) => Draft) => void;
}

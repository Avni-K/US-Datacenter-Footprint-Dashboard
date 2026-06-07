import { USStateFlags } from 'us-state-flags';
import { STATE_NAMES } from '../constants';

type StateFlagSize = 'sm' | 'md';

interface StateFlagProps {
  state: string;
  size?: StateFlagSize;
}

export function StateFlag({ state, size = 'sm' }: StateFlagProps) {
  return (
    <span
      className={`state-flag ${size}`}
      aria-label={`${STATE_NAMES[state] ?? state} flag`}
      title={`${STATE_NAMES[state] ?? state} flag`}
    >
      <USStateFlags state={state} showFlag flagSize={size === 'md' ? 'sm' : 'xs'} />
    </span>
  );
}

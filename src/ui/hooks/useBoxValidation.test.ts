import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBoxValidation } from '@/ui/hooks/useBoxValidation';

describe('useBoxValidation', () => {
  it('starts with no row showing and no confirm attempted', () => {
    const { result } = renderHook(() => useBoxValidation());
    expect(result.current.shouldShowFor('rent')).toBe(false);
    expect(result.current.confirmAttempted).toBe(false);
  });

  it('shows row after blur, hides again on edit', () => {
    const { result } = renderHook(() => useBoxValidation());

    act(() => result.current.markBlurred('rent'));
    expect(result.current.shouldShowFor('rent')).toBe(true);

    act(() => result.current.markEditing('rent'));
    expect(result.current.shouldShowFor('rent')).toBe(false);
  });

  it('after a failed confirm, all rows surface regardless of blur', () => {
    const { result } = renderHook(() => useBoxValidation());
    expect(result.current.shouldShowFor('food')).toBe(false);

    act(() => result.current.markConfirmAttemptFailed());
    expect(result.current.confirmAttempted).toBe(true);
    expect(result.current.shouldShowFor('food')).toBe(true);
    expect(result.current.shouldShowFor('emergencyFund')).toBe(true);
  });

  it('reset() clears blurred set and confirmAttempted', () => {
    const { result } = renderHook(() => useBoxValidation());
    act(() => {
      result.current.markBlurred('rent');
      result.current.markConfirmAttemptFailed();
    });
    expect(result.current.shouldShowFor('rent')).toBe(true);

    act(() => result.current.reset());
    expect(result.current.shouldShowFor('rent')).toBe(false);
    expect(result.current.confirmAttempted).toBe(false);
  });
});

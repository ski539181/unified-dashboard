import { describe, it, expect } from 'vitest';
import { cn } from '../lib/cn';

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('px-4', 'px-8')).toBe('px-8');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null)).toBe('foo');
  });
});

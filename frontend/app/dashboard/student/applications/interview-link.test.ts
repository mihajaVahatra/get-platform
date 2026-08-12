import { describe, expect, it } from 'vitest';
import { isSafeHttpsUrl } from './page';

describe('isSafeHttpsUrl — filet de sécurité frontend pour le lien d’entretien', () => {
  it('accepte une URL https valide', () => {
    expect(isSafeHttpsUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
  });

  it.each([
    ['schéma javascript:', 'javascript:alert(1)'],
    ['schéma data:', 'data:text/html,<script>alert(1)</script>'],
    ['http non chiffré', 'http://meet.google.com/abc-defg-hij'],
    ['chaîne arbitraire non-URL', 'ceci n’est pas un lien'],
    ['chaîne vide', ''],
  ])('refuse un lien avec %s', (_label, value) => {
    expect(isSafeHttpsUrl(value)).toBe(false);
  });
});

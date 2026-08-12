import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import toastDefault from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { LoginScreen } from './LoginScreen';

const toast = toastDefault as unknown as { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/LanguageDropdown', () => ({
  LanguageDropdown: () => null,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

async function reachMfaChallenge() {
  vi.mocked(apiClient.post).mockImplementation((url: string) => {
    if (url === '/auth/login') {
      return Promise.resolve({
        data: { data: { mfaRequired: true, challengeToken: 'challenge-1' } },
      });
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });

  render(<LoginScreen />);

  fireEvent.change(screen.getByLabelText(/email/i, { selector: 'input' }), {
    target: { value: 'admin@get.mg' },
  });
  fireEvent.change(
    screen.getByLabelText(/mot de passe|password/i, { selector: 'input' }),
    { target: { value: 'SecurePass123!' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'login' }));

  await waitFor(() =>
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument(),
  );
}

describe('LoginScreen — écran MFA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reste sur l’écran MFA et affiche un message local pour un code erroné (400)', async () => {
    await reachMfaChallenge();
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Code MFA invalide' } },
    });

    fireEvent.change(screen.getByPlaceholderText('123456'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verif/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Code MFA invalide'),
    );
    // Toujours sur l'écran MFA : le champ de code est encore affiché.
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
  });

  it('quitte l’écran MFA vers le formulaire de connexion pour un défi expiré (401), sans rechargement de page', async () => {
    await reachMfaChallenge();
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Session MFA expirée' } },
    });

    fireEvent.change(screen.getByPlaceholderText('123456'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verif/i }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText('123456')).not.toBeInTheDocument(),
    );
    // De retour sur le formulaire de connexion (React, pas un rechargement).
    expect(
      screen.getByLabelText(/email/i, { selector: 'input' }),
    ).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { apiClient } from '@/lib/api-client';
import { TeacherDashboard } from './teacher-dashboard';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

describe('TeacherDashboard', () => {
  it('affiche les statistiques renvoyées par l’API', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          courses: 3,
          submissionsToGrade: 7,
          upcomingEvaluations: 2,
          unreadMessages: 4,
        },
      },
    });

    render(<TeacherDashboard />);

    expect(
      await screen.findByText('Cours qui vous sont affectés'),
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('affiche un message d’erreur avec un bouton Réessayer si l’API échoue', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network error'));

    render(<TeacherDashboard />);

    expect(
      await screen.findByText('Votre activité n’a pas pu être chargée.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Réessayer' }),
    ).toBeInTheDocument();
  });
});

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
    const summary = {
      courses: 3,
      students: 42,
      submissionsToGrade: 7,
      upcomingEvaluations: 2,
      unreadMessages: 4,
    };
    // Mock par URL : le composant appelle aussi /teacher/courses/schedule
    // en parallèle, qui attend un tableau — un mockResolvedValue unique
    // pour les deux appels lui renverrait l'objet summary par erreur.
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/teacher/dashboard/summary')
        return Promise.resolve({ data: { data: summary } });
      if (url === '/teacher/courses/schedule')
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected url ${url}`));
    });

    render(<TeacherDashboard />);

    expect(await screen.findByText('Cours enseignés')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // unreadMessages n'est pas dans la grille de métriques — il n'apparaît
    // que dans le raccourci "Messages non lus", au sein d'un texte plus
    // large.
    expect(screen.getByText('4 messages en attente')).toBeInTheDocument();
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

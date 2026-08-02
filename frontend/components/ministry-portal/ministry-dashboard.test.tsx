import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { MinistryDashboard } from './ministry-dashboard';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn() },
}));

const dashboard = {
  period: { from: '2026-01-01', to: '2026-01-31' },
  totalApplications: 125,
  totalStudents: 120,
  totalSchools: 8,
  totalOffers: 21,
  acceptanceRate: 42,
  applicationsByStatus: [
    { status: 'PENDING', count: 35 },
    { status: 'ACCEPTED', count: 52 },
  ],
  regionalDistribution: [{ region: 'Analamanga', count: 80 }],
  applicationsBySchoolProgramme: [
    {
      school: 'ENI',
      region: 'Analamanga',
      city: 'Fianarantsoa',
      filiere: 'Informatique',
      programme: 'Licence',
      count: 40,
      acceptedCount: 18,
      pendingCount: 12,
    },
  ],
  enrollmentsBySchoolProgramme: [
    {
      school: 'ENI',
      region: 'Analamanga',
      city: 'Fianarantsoa',
      filiere: 'Informatique',
      programme: 'Licence',
      enrolledCount: 18,
    },
  ],
  trends: [
    {
      period: '2026-01',
      count: 125,
      acceptedCount: 52,
      pendingCount: 35,
    },
  ],
};

describe('MinistryDashboard', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('affiche uniquement des indicateurs agrégés renvoyés par l’API', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: dashboard } });

    render(<MinistryDashboard />);

    expect(await screen.findAllByText('ENI')).toHaveLength(2);
    expect(
      screen.getByText('Candidatures par établissement et programme'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Inscriptions par établissement et programme'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Informatique · Licence · Analamanga'),
    ).toHaveLength(2);
    expect(screen.getAllByText('En attente')).toHaveLength(2);
    expect(
      screen.queryByRole('columnheader', { name: 'Étudiant' }),
    ).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/ministry/dashboard', {
      params: { from: undefined, to: undefined },
    });
  });

  it('envoie la période explicitement appliquée à l’API', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: dashboard } });

    render(<MinistryDashboard />);
    await screen.findByText('Inscriptions par établissement et programme');

    fireEvent.change(screen.getByLabelText('Date de début'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('Date de fin'), {
      target: { value: '2026-02-28' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith('/ministry/dashboard', {
        params: { from: '2026-02-01', to: '2026-02-28' },
      });
    });
  });

  it('offre une reprise explicite quand les agrégats ne sont pas disponibles', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network error'));

    render(<MinistryDashboard />);

    expect(
      await screen.findByText(
        'Les indicateurs agrégés ne sont pas disponibles pour le moment.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Réessayer' }),
    ).toBeInTheDocument();
  });
});

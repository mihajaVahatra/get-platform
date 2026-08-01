import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { apiClient } from '@/lib/api-client';
import { TeacherDirectory } from './people-directory';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

describe('TeacherDirectory', () => {
  it('affiche les professeurs affectés à l’établissement', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/schools/me/teachers')
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'assignment-1',
                teacherId: 'teacher-1',
                department: 'Informatique',
                specialty: 'Algorithmique',
                isActive: true,
                teacher: { id: 'teacher-1', user: { email: 'prof@get.mg' } },
              },
            ],
          },
        });
      if (url === '/schools/me/teachers/inactive')
        return Promise.resolve({ data: { data: [] } });
      if (url === '/schools/me/subjects')
        return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error(`unexpected url ${url}`));
    });

    render(<TeacherDirectory />);

    expect(await screen.findByText('prof@get.mg')).toBeInTheDocument();
    expect(screen.getByText('Informatique')).toBeInTheDocument();
    expect(screen.getByText('Algorithmique')).toBeInTheDocument();
  });

  it('affiche un message lorsqu’aucun professeur n’est affecté', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });

    render(<TeacherDirectory />);

    expect(
      await screen.findByText('Aucun professeur affecté à cet établissement.'),
    ).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('affiche son contenu et déclenche onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);

    const button = screen.getByRole('button', { name: 'Valider' });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reste inerte lorsqu’il est désactivé', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Valider
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Valider' });
    expect(button).toBeDisabled();
    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});

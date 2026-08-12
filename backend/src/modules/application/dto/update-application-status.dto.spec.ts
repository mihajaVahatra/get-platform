import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScheduleInterviewDto } from './update-application-status.dto';

describe('ScheduleInterviewDto — validation du lien d’entretien', () => {
  it('accepte une URL https valide', async () => {
    const dto = plainToInstance(ScheduleInterviewDto, {
      date: '2026-09-01T10:00:00Z',
      link: 'https://meet.google.com/abc-defg-hij',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepte l’absence de lien (optionnel)', async () => {
    const dto = plainToInstance(ScheduleInterviewDto, {
      date: '2026-09-01T10:00:00Z',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it.each([
    ['schéma javascript:', 'javascript:alert(1)'],
    ['schéma data:', 'data:text/html,<script>alert(1)</script>'],
    ['http non chiffré', 'http://meet.google.com/abc-defg-hij'],
    ['URL relative sans schéma', 'meet.google.com/abc-defg-hij'],
    ['chaîne arbitraire non-URL', 'ceci n’est pas un lien'],
  ])('refuse un lien avec %s', async (_label, link) => {
    const dto = plainToInstance(ScheduleInterviewDto, {
      date: '2026-09-01T10:00:00Z',
      link,
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'link')).toBe(true);
  });
});

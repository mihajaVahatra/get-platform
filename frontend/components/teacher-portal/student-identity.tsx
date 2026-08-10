export function StudentIdentity({
  firstName,
  lastName,
  email,
}: {
  firstName: string;
  lastName: string;
  email?: string;
}) {
  const name = `${firstName} ${lastName}`;
  const initials =
    `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-xs font-bold text-indigo-600 dark:text-indigo-300">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-[#17204e]">{name}</p>
        {email && (
          <p className="truncate text-[11px] text-muted-foreground">
            {email}
          </p>
        )}
      </div>
    </div>
  );
}

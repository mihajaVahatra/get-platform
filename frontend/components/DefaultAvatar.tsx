'use client';

interface DefaultAvatarProps {
  gender?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  className?: string;
}

export function DefaultAvatar({
  gender,
  firstName,
  lastName,
  size = 40,
  className = '',
}: DefaultAvatarProps) {
  const getInitials = () => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  // Uniquement 2 couleurs : MALE → bleu, FEMALE → rose
  const bgColor = gender === 'FEMALE' ? 'bg-pink-500' : 'bg-blue-500';

  return (
    <div
      className={`${bgColor} text-white rounded-full flex items-center justify-center font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {getInitials() || '?'}
    </div>
  );
}

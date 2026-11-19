const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function getActiveMemberships(memberships, now = new Date()) {
  const today = dateKey(now);
  return memberships.filter((membership) => membership.status === 'ACTIVE'
    && membership.startDate && membership.startDate <= today
    && membership.endDate && membership.endDate >= today);
}

export function membershipDaysRemaining(endDate, now = new Date()) {
  if (!endDate) return 0;
  const [year, month, day] = endDate.split('-').map(Number);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((Date.UTC(year, month - 1, day) - today) / 86400000));
}

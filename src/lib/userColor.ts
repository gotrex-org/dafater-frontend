// One stable colour per user (by name), used to tint rows in any list that mixes
// multiple users' activity — activity log, treasury movements, daily report, … — so
// each user's rows are instantly distinguishable at a glance.
const USER_COLORS = ['#0f6e5c', '#b23a2e', '#2c5a86', '#b98a2e', '#7a3e9d', '#0b7285', '#a83232'];

export function colorFor(name?: string | null): string {
  if (!name) return '#8a8a8a';
  return USER_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % USER_COLORS.length];
}

// A soft, light wash of the user's colour for a whole-row background tint (same hue,
// lighter shade — readable under normal text).
export function rowTint(name?: string | null): string {
  return name ? colorFor(name) + '24' : 'transparent';
}

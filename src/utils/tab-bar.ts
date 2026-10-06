// Keep floating navigation and screen padding in sync on phones with a home indicator.
export function tabBarLayout(bottomInset: number) {
  const height = 70;
  const bottom = Math.max(10, bottomInset + 4);
  return { height, bottom, contentPadding: height + bottom + 20 };
}

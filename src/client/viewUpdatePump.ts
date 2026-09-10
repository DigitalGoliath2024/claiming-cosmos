/** How many worker ticks to fold into the next render frame. */
export function viewUpdatesToApplyThisFrame(
  queueLength: number,
  documentHidden: boolean,
): number {
  if (queueLength <= 0) {
    return 0;
  }
  if (documentHidden) {
    return queueLength;
  }
  if (queueLength > 12) {
    return 3;
  }
  if (queueLength > 6) {
    return 2;
  }
  return 1;
}

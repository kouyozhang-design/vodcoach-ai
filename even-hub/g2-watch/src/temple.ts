/**
 * OsEventTypeList ordinals from @evenrealities/even_hub_sdk 0.0.16.
 * Click is 0 and the bridge sometimes omits it. Long press arrives on sysEvent.
 */
export function templeEventType(event: {
  textEvent?: { eventType?: number };
  sysEvent?: { eventType?: number };
}): number | null {
  if (event.textEvent) {
    const type = event.textEvent.eventType;
    if (type === undefined || type === 0) return 0;
    if (type === 1 || type === 2 || type === 3) return type;
    return null;
  }
  const sys = event.sysEvent?.eventType;
  if (sys === 9 || sys === 10) return sys;
  return null;
}

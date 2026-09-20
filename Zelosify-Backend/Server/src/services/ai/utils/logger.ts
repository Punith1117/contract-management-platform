export interface LogEventDetails {
  event: string;
  profileId?: number;
  openingId?: number | string;
  [key: string]: any;
}

export class AILogger {
  /**
   * Output structured JSON event log
   */
  static info(event: string, details: Record<string, any> = {}): void {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...details,
    };
    console.log(JSON.stringify(payload));
  }

  /**
   * Output structured JSON warning event log
   */
  static warn(event: string, details: Record<string, any> = {}): void {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...details,
    };
    console.warn(JSON.stringify(payload));
  }

  /**
   * Output structured JSON error event log
   */
  static error(event: string, details: Record<string, any> = {}): void {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...details,
    };
    console.error(JSON.stringify(payload));
  }
}

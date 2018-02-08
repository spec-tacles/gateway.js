export default class CloseEvent {
  public readonly code: number;
  public readonly reason: string;
  public readonly wasClean: boolean;

  constructor(code: number, reason: string = '', wasClean: boolean = true) {
    this.code = code;
    this.reason = reason;
    this.wasClean = wasClean;
  }

  public toString() {
    return `WebSocket closed: ${this.code}${this.reason && ` (${this.code})`}`;
  }
}
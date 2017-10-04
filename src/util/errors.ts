export enum codes {
  NO_GATEWAY,
  NO_SESSION,
  ERLPACK_NOT_INSTALLED,
  INVALID_ENCODING,
};

export const messages = {
  [codes.NO_GATEWAY]: 'No gateway to connect to.',
  [codes.NO_SESSION]: 'No session to available.',
  [codes.ERLPACK_NOT_INSTALLED]: 'Cannot use etf encoding without erlpack installed.',
  [codes.INVALID_ENCODING]: 'Invalid encoding specified.',
};

export class Error extends global.Error {
  public readonly code: codes;

  constructor(code: codes) {
    super(messages[code]);
    this.code = code;
  }
}

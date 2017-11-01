export enum codes {
  NO_GATEWAY,
  NO_SESSION,
  INVALID_ENCODING,
  ALREADY_SPAWNED,
};

export const messages = {
  [codes.NO_GATEWAY]: 'No gateway to connect to.',
  [codes.NO_SESSION]: 'No session to available.',
  [codes.INVALID_ENCODING]: 'Invalid encoding specified.',
  [codes.ALREADY_SPAWNED]: 'Shards have already been spawned.',
};

export class Error extends global.Error {
  public readonly code: codes;

  constructor(code: codes) {
    super(messages[code]);
    this.code = code;
  }
}

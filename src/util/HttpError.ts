export default class HttpError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

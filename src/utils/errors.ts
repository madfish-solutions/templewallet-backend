import type { StatusCodes } from 'http-status-codes';

interface CodedErrorForResponse {
  message: string;
  code?: string;
}

type StatusCodeNumber = (typeof StatusCodes)[keyof typeof StatusCodes];

export class CodedError extends Error {
  constructor(public code: StatusCodeNumber, message: string, public errorCode?: string) {
    super(message);
  }

  buildResponse() {
    const res: CodedErrorForResponse = { message: this.message };
    if (this.errorCode) res.code = this.errorCode;

    return res;
  }
}

export const isAbortError = (error: unknown): error is Error & { name: 'AbortError' } =>
  error instanceof Error && error.name === 'AbortError';

export const isTimeoutError = (error: unknown): error is Error & { name: 'TimeoutError' } =>
  error instanceof Error && error.name === 'TimeoutError';

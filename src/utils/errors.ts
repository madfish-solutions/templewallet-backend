interface CodedErrorForResponse {
  message: string;
  code?: string;
}

export class CodedError extends Error {
  constructor(public code: number, message: string, public errorCode?: string) {
    super(message);
  }

  buildResponse() {
    const res: CodedErrorForResponse = { message: this.message };
    if (this.errorCode) res.code = this.errorCode;

    return res;
  }
}

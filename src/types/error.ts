type ErrorDetail = {
  detail: string;
  type?: string;
};

export type ErrorData = {
  message: string;
  errors: ErrorDetail[];
  type?: string;
};

export type AuthApiErrorResponse = {
  error: string;
  error_description: string;
};

export type CommonApiErrorResponse = {
  status: number;
  type?: string;
  title?: string;
  detail?: string;
  instance?: string;
  errors?: string[] | Record<string, string[]>;
};

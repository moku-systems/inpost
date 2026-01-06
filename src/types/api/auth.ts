export type AuthApiResponse = {
  access_token: string;
  expires_in: number;
  refresg_expires_in: number;
  refresh_token: string;
  token_type: 'Bearer';
  id_token: string;
  'not-before-policy': number;
  scope: string;
};

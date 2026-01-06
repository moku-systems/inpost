export type AccessToken = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: Date;
  scope: string;
};

export type AuthScope =
  | 'api:colled-deposit:read'
  | 'api:colled-deposit:write'
  | 'api:one-time-pickups:read'
  | 'api:one-time-pickups:write'
  | 'api:points:read'
  | 'api:shipments:write'
  | 'api:tracking:read'
  | 'email';

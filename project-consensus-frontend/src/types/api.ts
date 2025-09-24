import { User } from './user';

/**
 * API response types aligned with backend accounts endpoints.
 */

// POST /api/accounts/send_verification_code/
export interface SendVerificationCodeResponse {
  success: boolean;
  message?: string;
}

// POST /api/accounts/register/
export interface RegisterSuccessResponse {
  success: true;
  user: User;
  token: string;
}

export interface ErrorResponse {
  message?: string;
  detail?: string;
}

// POST /api/accounts/login/
export interface LoginSuccessResponse {
  success: true;
  user: User;
  token: string;
}

export type RegisterResponse = RegisterSuccessResponse | ErrorResponse;
export type LoginApiResponse = LoginSuccessResponse | ErrorResponse;



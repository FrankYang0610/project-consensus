import { User } from '../user';
import { ErrorResponse } from './common';

// MARK: ============ Accounts API types ============

// POST /api/accounts/send_verification_code/
export interface SendVerificationCodeResponse {
  success: boolean;
  email: string; // The email address the code was sent to
  message?: string;
  resend_after_seconds?: number;
}

// POST /api/accounts/register/
export interface RegisterSuccessResponse {
  success: true;
  user: User;
}

// POST /api/accounts/login/
export interface LoginSuccessResponse {
  success: true;
  user: User;
}

export type RegisterResponse = RegisterSuccessResponse | ErrorResponse;
export type LoginApiResponse = LoginSuccessResponse | ErrorResponse;

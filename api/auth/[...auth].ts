import { Auth } from '@auth/core';
import { authConfig } from '../../src/lib/auth-server';

// Vercel Edge Function：Auth.js 全端点处理（/api/auth/* 与 /api/auth/callback/github）。
export const config = { runtime: 'edge' as const };

export default function handler(request: Request): Promise<Response> {
  return Auth(request, authConfig);
}

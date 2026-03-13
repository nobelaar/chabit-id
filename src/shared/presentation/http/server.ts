import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { errorHandler } from './error-handler.js';
import { createCorsMiddleware } from './cors.middleware.js';
// Verification
import { createVerificationRoutes } from '../../../modules/verification/presentation/http/verification.routes.js';
import { RequestEmailVerificationUseCase } from '../../../modules/verification/application/use-cases/RequestEmailVerification.usecase.js';
import { VerifyEmailUseCase } from '../../../modules/verification/application/use-cases/VerifyEmail.usecase.js';
import { PostgresEmailVerificationRepository } from '../../../modules/verification/infrastructure/adapters/PostgresEmailVerificationRepository.js';
import { PostgresEmailEventRepository } from '../../../modules/verification/infrastructure/adapters/PostgresEmailEventRepository.js';
import { HmacOtpHasher } from '../../../modules/verification/infrastructure/adapters/HmacOtpHasher.js';
import { CryptoOtpGenerator } from '../../../modules/verification/infrastructure/adapters/CryptoOtpGenerator.js';
import { StubEmailSender } from '../../../modules/verification/infrastructure/adapters/StubEmailSender.js';
import { PostgresTransactionRunner } from '../../../modules/verification/infrastructure/adapters/PostgresTransactionRunner.js';
import { pgPool } from '../../infrastructure/db/pgPool.js';
// Credential
import { BcryptPasswordHasher } from '../../../modules/credential/infrastructure/adapters/BcryptPasswordHasher.js';
import { JwtTokenService } from '../../../modules/credential/infrastructure/adapters/JwtTokenService.js';
import { StaticUsernameReservedList } from '../../../modules/credential/infrastructure/adapters/StaticUsernameReservedList.js';
import { PostgresCredentialRepository } from '../../../modules/credential/infrastructure/persistence/PostgresCredentialRepository.js';
import { PostgresSessionRepository } from '../../../modules/credential/infrastructure/persistence/PostgresSessionRepository.js';
import { CreateCredentialUseCase } from '../../../modules/credential/application/use-cases/CreateCredential.usecase.js';
import { SignInUseCase } from '../../../modules/credential/application/use-cases/SignIn.usecase.js';
import { RefreshTokenUseCase } from '../../../modules/credential/application/use-cases/RefreshToken.usecase.js';
import { RevokeTokenUseCase } from '../../../modules/credential/application/use-cases/RevokeToken.usecase.js';
import { RevokeAllTokensUseCase } from '../../../modules/credential/application/use-cases/RevokeAllTokens.usecase.js';
import { ChangePasswordUseCase } from '../../../modules/credential/application/use-cases/ChangePassword.usecase.js';
import { ChangeUsernameUseCase } from '../../../modules/credential/application/use-cases/ChangeUsername.usecase.js';
import { createCredentialRoutes } from '../../../modules/credential/presentation/http/credential.routes.js';

export interface AppContext {
  app: Hono;
  server: ServerType;
}

export function createApp(): Hono {
  const app = new Hono();

  // ── Health check (public, before CORS) ────────────────────────────
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // ── CORS ──────────────────────────────────────────────────────────
  app.use('*', createCorsMiddleware());

  // ── Infrastructure ────────────────────────────────────────────────
  const verificationRepo = new PostgresEmailVerificationRepository(pgPool);
  const eventRepo = new PostgresEmailEventRepository(pgPool);
  const hasher = new HmacOtpHasher();
  const generator = new CryptoOtpGenerator();
  const emailSender = new StubEmailSender();

  // ── Use cases ─────────────────────────────────────────────────────
  const requestVerification = new RequestEmailVerificationUseCase(
    verificationRepo,
    eventRepo,
    hasher,
    generator,
    emailSender,
  );

  const txRunner = new PostgresTransactionRunner(pgPool);

  const verifyEmail = new VerifyEmailUseCase(
    verificationRepo,
    eventRepo,
    hasher,
    txRunner,
  );

  // ── Credential infrastructure ─────────────────────────────────────
  const credentialRepo = new PostgresCredentialRepository(pgPool);
  const sessionRepo = new PostgresSessionRepository(pgPool);
  const passwordHasher = new BcryptPasswordHasher();
  const jwtSecret = process.env['JWT_SECRET'] ?? 'dev-secret';
  const tokenService = new JwtTokenService(jwtSecret);
  const reservedList = new StaticUsernameReservedList();
  const stubAccountQuery = { getAccountsByIdentityRef: async () => [] };

  // ── Credential use cases ──────────────────────────────────────────
  const _createCredential = new CreateCredentialUseCase(credentialRepo, passwordHasher, reservedList);
  const signIn = new SignInUseCase(credentialRepo, sessionRepo, passwordHasher, tokenService, stubAccountQuery);
  const refreshToken = new RefreshTokenUseCase(credentialRepo, sessionRepo, tokenService, stubAccountQuery);
  const revokeToken = new RevokeTokenUseCase(sessionRepo);
  const _revokeAllTokens = new RevokeAllTokensUseCase(credentialRepo, sessionRepo);
  const _changePassword = new ChangePasswordUseCase(credentialRepo, sessionRepo, passwordHasher);
  const _changeUsername = new ChangeUsernameUseCase(credentialRepo, reservedList);

  // ── Routes ────────────────────────────────────────────────────────
  const verificationRoutes = createVerificationRoutes(requestVerification, verifyEmail);
  app.route('/verification', verificationRoutes);

  const credentialRoutes = createCredentialRoutes(signIn, refreshToken, revokeToken);
  app.route('/auth', credentialRoutes);

  // ── Error handler (last) ──────────────────────────────────────────
  app.onError(errorHandler);

  return app;
}

export function startServer(port: number): AppContext {
  const app = createApp();

  console.log(`\n🚀 chabit-identity starting on http://localhost:${port}`);

  const server = serve({ fetch: app.fetch, port });

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   AVAILABLE ENDPOINTS                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  GET    http://localhost:${port}/health                      ║`);
  console.log(`║  POST   http://localhost:${port}/verification/email           ║`);
  console.log(`║  POST   http://localhost:${port}/verification/email/verify    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  return { app, server };
}

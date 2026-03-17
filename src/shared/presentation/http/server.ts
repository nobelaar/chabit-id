import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { errorHandler } from './error-handler.js';
import { createCorsMiddleware } from './cors.middleware.js';
import { logger } from '../../infrastructure/logger.js';
import { openApiSpec } from './openapi.js';
// Verification
import { createVerificationRoutes } from '../../../modules/verification/presentation/http/verification.routes.js';
import { RequestEmailVerificationUseCase } from '../../../modules/verification/application/use-cases/RequestEmailVerification.usecase.js';
import { VerifyEmailUseCase } from '../../../modules/verification/application/use-cases/VerifyEmail.usecase.js';
import { PostgresEmailVerificationRepository } from '../../../modules/verification/infrastructure/adapters/PostgresEmailVerificationRepository.js';
import { PostgresEmailEventRepository } from '../../../modules/verification/infrastructure/adapters/PostgresEmailEventRepository.js';
import { HmacOtpHasher } from '../../../modules/verification/infrastructure/adapters/HmacOtpHasher.js';
import { CryptoOtpGenerator } from '../../../modules/verification/infrastructure/adapters/CryptoOtpGenerator.js';
import { StubEmailSender } from '../../../modules/verification/infrastructure/adapters/StubEmailSender.js';
import { NodemailerEmailSender } from '../../../modules/verification/infrastructure/adapters/NodemailerEmailSender.js';
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
import { ResetPasswordUseCase } from '../../../modules/credential/application/use-cases/ResetPassword.usecase.js';
import { createCredentialRoutes } from '../../../modules/credential/presentation/http/credential.routes.js';
// Identity
import { PostgresIdentityRepository } from '../../../modules/identity/infrastructure/persistence/PostgresIdentityRepository.js';
import { CreateIdentityUseCase } from '../../../modules/identity/application/use-cases/CreateIdentity.usecase.js';
// Registration
import { RegisterSaga } from '../../../modules/registration/application/RegisterSaga.js';
import { createRegistrationRoutes } from '../../../modules/registration/presentation/http/registration.routes.js';
// Account
import { PostgresAccountRepository } from '../../../modules/account/infrastructure/persistence/PostgresAccountRepository.js';
import { PostgresAccountEventRepository } from '../../../modules/account/infrastructure/persistence/PostgresAccountEventRepository.js';
import { PostgresAccountQueryAdapter } from '../../../modules/account/infrastructure/adapters/PostgresAccountQueryAdapter.js';
import { CreateAccountUseCase } from '../../../modules/account/application/use-cases/CreateAccount.usecase.js';
import { RequestOrganizerUseCase } from '../../../modules/account/application/use-cases/RequestOrganizer.usecase.js';
import { ApproveOrganizerUseCase } from '../../../modules/account/application/use-cases/ApproveOrganizer.usecase.js';
import { RejectOrganizerUseCase } from '../../../modules/account/application/use-cases/RejectOrganizer.usecase.js';
import { ReRequestOrganizerUseCase } from '../../../modules/account/application/use-cases/ReRequestOrganizer.usecase.js';
import { DeactivateAccountUseCase } from '../../../modules/account/application/use-cases/DeactivateAccount.usecase.js';
import { ReactivateAccountUseCase } from '../../../modules/account/application/use-cases/ReactivateAccount.usecase.js';
import { GetAccountsByIdentityUseCase } from '../../../modules/account/application/use-cases/GetAccountsByIdentity.usecase.js';
import { RequestStaffUseCase } from '../../../modules/account/application/use-cases/RequestStaff.usecase.js';
import { ReRequestStaffUseCase } from '../../../modules/account/application/use-cases/ReRequestStaff.usecase.js';
import { createAccountRoutes } from '../../../modules/account/presentation/http/account.routes.js';
import { GetIdentityUseCase } from '../../../modules/identity/application/use-cases/GetIdentity.usecase.js';
import { createIdentityRoutes } from '../../../modules/identity/presentation/http/identity.routes.js';
import { HttpWebhookSender } from '../../infrastructure/http/HttpWebhookSender.js';

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

  // ── Docs ──────────────────────────────────────────────────────────
  app.get('/docs', swaggerUI({ url: '/docs/spec' }));
  app.get('/docs/spec', (c) => c.json(openApiSpec));

  // ── HTTP request logging ───────────────────────────────────────────
  app.use('*', async (c, next) => {
    if (c.req.path === '/health') {
      await next();
      return;
    }
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms }, 'request');
  });

  // ── Infrastructure ────────────────────────────────────────────────
  const verificationRepo = new PostgresEmailVerificationRepository(pgPool);
  const eventRepo = new PostgresEmailEventRepository(pgPool);
  const hasher = new HmacOtpHasher();
  const generator = new CryptoOtpGenerator();
  const smtpHost = process.env['SMTP_HOST'];
  const emailSender = smtpHost
    ? new NodemailerEmailSender({
        host: smtpHost,
        port: Number(process.env['SMTP_PORT'] ?? '25'),
        secure: process.env['SMTP_SECURE'] === 'true',
        user: process.env['SMTP_USER'],
        pass: process.env['SMTP_PASS'],
        from: process.env['SMTP_FROM'] ?? 'noreply@chabit.com',
      })
    : new StubEmailSender();

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

  // ── Identity infrastructure ───────────────────────────────────────
  const identityRepo = new PostgresIdentityRepository(pgPool);

  // ── Account infrastructure ────────────────────────────────────────
  const accountRepo = new PostgresAccountRepository(pgPool);
  const accountEventRepo = new PostgresAccountEventRepository(pgPool);
  const accountQueryAdapter = new PostgresAccountQueryAdapter(pgPool);

  // ── Credential use cases ──────────────────────────────────────────
  const createCredentialUseCase = new CreateCredentialUseCase(credentialRepo, passwordHasher, reservedList);
  const signIn = new SignInUseCase(credentialRepo, sessionRepo, passwordHasher, tokenService, accountQueryAdapter);
  const refreshToken = new RefreshTokenUseCase(credentialRepo, sessionRepo, tokenService, accountQueryAdapter);
  const revokeToken = new RevokeTokenUseCase(sessionRepo);
  const revokeAllTokensUseCase = new RevokeAllTokensUseCase(credentialRepo, sessionRepo);
  const changePasswordUseCase = new ChangePasswordUseCase(credentialRepo, sessionRepo, passwordHasher);
  const changeUsernameUseCase = new ChangeUsernameUseCase(credentialRepo, reservedList);
  const resetPasswordUseCase = new ResetPasswordUseCase(
    verificationRepo,
    hasher,
    identityRepo,
    credentialRepo,
    sessionRepo,
    passwordHasher,
  );

  // ── Identity use cases ────────────────────────────────────────────
  const createIdentityUseCase = new CreateIdentityUseCase(identityRepo);

  // ── Account use cases ─────────────────────────────────────────────
  const createAccountUseCase = new CreateAccountUseCase(accountRepo, accountEventRepo);
  const requestOrganizer = new RequestOrganizerUseCase(accountRepo, accountEventRepo);
  const approveOrganizer = new ApproveOrganizerUseCase(accountRepo, accountEventRepo);
  const rejectOrganizer = new RejectOrganizerUseCase(accountRepo, accountEventRepo);
  const reRequestOrganizer = new ReRequestOrganizerUseCase(accountRepo, accountEventRepo);
  const _deactivateAccount = new DeactivateAccountUseCase(accountRepo, accountEventRepo);
  const _reactivateAccount = new ReactivateAccountUseCase(accountRepo, accountEventRepo);
  const getAccountsByIdentity = new GetAccountsByIdentityUseCase(accountRepo);
  const requestStaff = new RequestStaffUseCase(accountRepo, accountEventRepo);
  const reRequestStaff = new ReRequestStaffUseCase(accountRepo, accountEventRepo);
  const getIdentity = new GetIdentityUseCase(identityRepo);
  const webhookSecret = process.env['WEBHOOK_SECRET'] ?? '';
  if (!webhookSecret && process.env['WEBHOOK_BACKEND_URL']) {
    logger.warn('[server] WEBHOOK_SECRET is not set but WEBHOOK_BACKEND_URL is configured — webhook signatures will be invalid');
  }
  const webhookSender = new HttpWebhookSender(webhookSecret);

  // ── Routes ────────────────────────────────────────────────────────
  const verificationRoutes = createVerificationRoutes(requestVerification, verifyEmail);
  app.route('/verification', verificationRoutes);

  const credentialRoutes = createCredentialRoutes(
    signIn,
    refreshToken,
    revokeToken,
    changePasswordUseCase,
    revokeAllTokensUseCase,
    changeUsernameUseCase,
    resetPasswordUseCase,
    requestVerification,
  );
  app.route('/auth', credentialRoutes);

  const accountRoutes = createAccountRoutes(
    requestOrganizer,
    approveOrganizer,
    rejectOrganizer,
    reRequestOrganizer,
    getAccountsByIdentity,
    requestStaff,
    reRequestStaff,
  );
  app.route('/accounts', accountRoutes);

  const identityRoutes = createIdentityRoutes(getIdentity);
  app.route('/identities', identityRoutes);

  // ── Registration ──────────────────────────────────────────────────
  const registerSaga = new RegisterSaga(
    verificationRepo,
    createIdentityUseCase,
    identityRepo,
    createCredentialUseCase,
    credentialRepo,
    createAccountUseCase,
    accountRepo,
    signIn,
    webhookSender,
  );
  const registrationRoutes = createRegistrationRoutes(registerSaga);
  app.route('/register', registrationRoutes);

  // ── Error handler (last) ──────────────────────────────────────────
  app.onError(errorHandler);

  return app;
}

export function startServer(port: number): AppContext {
  const app = createApp();

  const server = serve({ fetch: app.fetch, port });

  logger.info(
    {
      service: 'chabit-identity',
      port,
      endpoints: [
        'GET  /health',
        'GET  /docs',
        'GET  /docs/spec',
        'POST /verification/email',
        'POST /verification/email/verify',
        'POST /register',
        'POST /auth/sign-in',
        'POST /auth/refresh',
        'POST /auth/sign-out',
        'POST /auth/sign-out/all',
        'PATCH /auth/change-password',
        'PATCH /auth/change-username',
        'POST /auth/forgot-password',
        'POST /auth/reset-password',
        'POST /accounts/staff-request',
        'POST /accounts/staff-re-request',
        'GET  /identities/:identityRef',
      ],
    },
    'server started',
  );

  return { app, server };
}

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { errorHandler } from './error-handler.js';
import { createCorsMiddleware } from './cors.middleware.js';
import { securityHeadersMiddleware } from './security-headers.middleware.js';
import { logger } from '../../infrastructure/logger.js';
import { openApiSpec } from './openapi.js';
import { getRedisClient } from '../../infrastructure/redis/redisClient.js';
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
import { SetupTOTPUseCase } from '../../../modules/credential/application/use-cases/SetupTOTP.usecase.js';
import { EnableTOTPUseCase } from '../../../modules/credential/application/use-cases/EnableTOTP.usecase.js';
import { VerifyTOTPUseCase } from '../../../modules/credential/application/use-cases/VerifyTOTP.usecase.js';
import { DisableTOTPUseCase } from '../../../modules/credential/application/use-cases/DisableTOTP.usecase.js';
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
import { AddStaffByOrganizerUseCase } from '../../../modules/account/application/use-cases/AddStaffByOrganizer.usecase.js';
import { RemoveStaffByOrganizerUseCase } from '../../../modules/account/application/use-cases/RemoveStaffByOrganizer.usecase.js';
import { RemoveStaffByIdentityRefUseCase } from '../../../modules/account/application/use-cases/RemoveStaffByIdentityRef.usecase.js';
import { RequestCommerceUseCase } from '../../../modules/account/application/use-cases/RequestCommerce.usecase.js';
import { ReRequestCommerceUseCase } from '../../../modules/account/application/use-cases/ReRequestCommerce.usecase.js';
import { AddEmployeeByCommerceUseCase } from '../../../modules/account/application/use-cases/AddEmployeeByCommerce.usecase.js';
import { RemoveEmployeeByCommerceUseCase } from '../../../modules/account/application/use-cases/RemoveEmployeeByCommerce.usecase.js';
import { RemoveEmployeeByIdentityRefUseCase } from '../../../modules/account/application/use-cases/RemoveEmployeeByIdentityRef.usecase.js';
import { createAccountRoutes } from '../../../modules/account/presentation/http/account.routes.js';
import { GetIdentityUseCase } from '../../../modules/identity/application/use-cases/GetIdentity.usecase.js';
import { GetIdentityByEmailUseCase } from '../../../modules/identity/application/use-cases/GetIdentityByEmail.usecase.js';
import { createIdentityRoutes } from '../../../modules/identity/presentation/http/identity.routes.js';
// Check
import { createCheckRoutes } from '../../../modules/check/presentation/http/check.routes.js';
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

  // ── Security headers ──────────────────────────────────────────────
  app.use('*', securityHeadersMiddleware);

  // ── Docs ──────────────────────────────────────────────────────────
  app.get('/docs', swaggerUI({ url: '/docs/spec' }));
  app.get('/docs/spec', (c) => {
    const host = c.req.header('host') ?? `localhost:${process.env.PORT ?? 3001}`;
    const proto = c.req.header('x-forwarded-proto') ?? 'http';
    return c.json({ ...openApiSpec, servers: [{ url: `${proto}://${host}`, description: 'Current server' }] });
  });

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
  const setupTotp = new SetupTOTPUseCase(credentialRepo);
  const enableTotp = new EnableTOTPUseCase(credentialRepo);
  const verifyTotp = new VerifyTOTPUseCase(credentialRepo, sessionRepo, tokenService, accountQueryAdapter);
  const disableTotp = new DisableTOTPUseCase(credentialRepo);

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
  const addStaffByOrganizer = new AddStaffByOrganizerUseCase(accountRepo, accountEventRepo);
  const removeStaffByOrganizer = new RemoveStaffByOrganizerUseCase(accountRepo, accountEventRepo);
  const removeStaffByIdentityRef = new RemoveStaffByIdentityRefUseCase(accountRepo, accountEventRepo);
  const requestCommerce = new RequestCommerceUseCase(accountRepo, accountEventRepo);
  const reRequestCommerce = new ReRequestCommerceUseCase(accountRepo, accountEventRepo);
  const addEmployeeByCommerce = new AddEmployeeByCommerceUseCase(accountRepo, accountEventRepo);
  const removeEmployeeByCommerce = new RemoveEmployeeByCommerceUseCase(accountRepo, accountEventRepo);
  const removeEmployeeByIdentityRef = new RemoveEmployeeByIdentityRefUseCase(accountRepo, accountEventRepo);
  const getIdentity = new GetIdentityUseCase(identityRepo);
  const getIdentityByEmail = new GetIdentityByEmailUseCase(identityRepo);
  const webhookSecret = process.env['WEBHOOK_SECRET'] ?? '';
  if (!webhookSecret && process.env['WEBHOOK_BACKEND_URL']) {
    logger.warn('[server] WEBHOOK_SECRET is not set but WEBHOOK_BACKEND_URL is configured — webhook signatures will be invalid');
  }
  const webhookSender = new HttpWebhookSender(webhookSecret);

  // ── Routes ────────────────────────────────────────────────────────
  const redis = getRedisClient();

  const verificationRoutes = createVerificationRoutes(requestVerification, verifyEmail, redis);
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
    setupTotp,
    enableTotp,
    verifyTotp,
    disableTotp,
    redis,
    jwtSecret,
  );
  app.route('/auth', credentialRoutes);

  const accountRoutes = createAccountRoutes(
    requestOrganizer,
    approveOrganizer,
    rejectOrganizer,
    reRequestOrganizer,
    getAccountsByIdentity,
    addStaffByOrganizer,
    removeStaffByOrganizer,
    removeStaffByIdentityRef,
    requestCommerce,
    reRequestCommerce,
    addEmployeeByCommerce,
    removeEmployeeByCommerce,
    removeEmployeeByIdentityRef,
    jwtSecret,
  );
  app.route('/accounts', accountRoutes);

  const identityRoutes = createIdentityRoutes(getIdentity, getIdentityByEmail, jwtSecret);
  app.route('/identities', identityRoutes);

  const checkRoutes = createCheckRoutes(identityRepo, credentialRepo, redis);
  app.route('/check', checkRoutes);

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
        'POST /auth/2fa/verify',
        'POST /auth/2fa/setup',
        'POST /auth/2fa/enable',
        'DELETE /auth/2fa',
        'POST /accounts/staff-add',
        'GET  /identities?email=...',
        'GET  /identities/:identityRef',
        'GET  /check/username',
        'GET  /check/email',
        'GET  /check/phone',
      ],
    },
    'server started',
  );

  return { app, server };
}

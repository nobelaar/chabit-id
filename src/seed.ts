/**
 * chabit-identity seed
 *
 * Crea los usuarios base (admin, organizer, user) directamente usando los
 * use cases internos con repos Postgres reales. Bypasea el OTP — inyecta
 * la verification como ya usada antes de correr la saga.
 *
 * Uso:
 *   npx tsx src/seed.ts
 *
 * Requiere las mismas variables de entorno que la app (.env o docker env).
 * Al final imprime un JSON con los identityRef de cada usuario seedeado,
 * listo para pasarle al seed de backend-chabit.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { MigrationRunner } from './shared/infrastructure/db/MigrationRunner.js';
import { logger } from './shared/infrastructure/logger.js';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { PostgresEmailVerificationRepository } from './modules/verification/infrastructure/adapters/PostgresEmailVerificationRepository.js';
import { PostgresEmailEventRepository } from './modules/verification/infrastructure/adapters/PostgresEmailEventRepository.js';
import { HmacOtpHasher } from './modules/verification/infrastructure/adapters/HmacOtpHasher.js';
import { CryptoOtpGenerator } from './modules/verification/infrastructure/adapters/CryptoOtpGenerator.js';
import { StubEmailSender } from './modules/verification/infrastructure/adapters/StubEmailSender.js';
import { PostgresTransactionRunner } from './modules/verification/infrastructure/adapters/PostgresTransactionRunner.js';

import { PostgresCredentialRepository } from './modules/credential/infrastructure/persistence/PostgresCredentialRepository.js';
import { PostgresSessionRepository } from './modules/credential/infrastructure/persistence/PostgresSessionRepository.js';
import { BcryptPasswordHasher } from './modules/credential/infrastructure/adapters/BcryptPasswordHasher.js';
import { JwtTokenService } from './modules/credential/infrastructure/adapters/JwtTokenService.js';
import { StaticUsernameReservedList } from './modules/credential/infrastructure/adapters/StaticUsernameReservedList.js';

import { PostgresIdentityRepository } from './modules/identity/infrastructure/persistence/PostgresIdentityRepository.js';

import { PostgresAccountRepository } from './modules/account/infrastructure/persistence/PostgresAccountRepository.js';
import { PostgresAccountEventRepository } from './modules/account/infrastructure/persistence/PostgresAccountEventRepository.js';
import { PostgresAccountQueryAdapter } from './modules/account/infrastructure/adapters/PostgresAccountQueryAdapter.js';

import { HttpWebhookSender } from './shared/infrastructure/http/HttpWebhookSender.js';

// ── Use cases ──────────────────────────────────────────────────────────────────
import { RequestEmailVerificationUseCase } from './modules/verification/application/use-cases/RequestEmailVerification.usecase.js';
import { VerifyEmailUseCase } from './modules/verification/application/use-cases/VerifyEmail.usecase.js';
import { CreateIdentityUseCase } from './modules/identity/application/use-cases/CreateIdentity.usecase.js';
import { CreateCredentialUseCase } from './modules/credential/application/use-cases/CreateCredential.usecase.js';
import { CreateAccountUseCase } from './modules/account/application/use-cases/CreateAccount.usecase.js';
import { ApproveOrganizerUseCase } from './modules/account/application/use-cases/ApproveOrganizer.usecase.js';
import { SignInUseCase } from './modules/credential/application/use-cases/SignIn.usecase.js';

// ── Saga ───────────────────────────────────────────────────────────────────────
import { RegisterSaga } from './modules/registration/application/RegisterSaga.js';

// ──────────────────────────────────────────────────────────────────────────────

interface SeedUser {
  email: string;
  fullName: string;
  username: string;
  phone: string;
  nationality: string;
  country: string;
  password: string;
  role: 'USER' | 'ORGANIZER' | 'ADMIN';
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'admin@example.com',
    fullName: 'Super Admin',
    username: 'adminuser',
    phone: '+541100000003',
    nationality: 'Argentina',
    country: 'Argentina',
    password: 'supersecure',
    role: 'ADMIN',
  },
  {
    email: 'organizer@example.com',
    fullName: 'Organizer One',
    username: 'organizer1',
    phone: '+541100000001',
    nationality: 'Argentina',
    country: 'Argentina',
    password: 'supersecure',
    role: 'ORGANIZER',
  },
  {
    email: 'user@example.com',
    fullName: 'Regular User',
    username: 'regularuser',
    phone: '+541100000002',
    nationality: 'Argentina',
    country: 'Argentina',
    password: 'supersecure',
    role: 'USER',
  },
];

async function seedUser(
  user: SeedUser,
  deps: {
    requestVerification: RequestEmailVerificationUseCase;
    verifyEmail: VerifyEmailUseCase;
    registerSaga: RegisterSaga;
    emailSender: StubEmailSender;
    approveOrganizer: ApproveOrganizerUseCase;
    accountRepo: PostgresAccountRepository;
    adminIdentityRef?: string; // needed to create ADMIN accounts
  },
): Promise<{ identityRef: string; accessToken: string }> {
  const { requestVerification, verifyEmail, registerSaga, emailSender, approveOrganizer, accountRepo, adminIdentityRef } = deps;

  // Step 1 — request OTP (lands in StubEmailSender, never actually sent)
  const { verificationId } = await requestVerification.execute({ email: user.email });

  // Step 2 — grab the OTP from the stub and verify it immediately
  const otp = emailSender.getLastCode(user.email);
  if (!otp) throw new Error(`No OTP captured for ${user.email}`);

  await verifyEmail.execute({ email: user.email, code: otp });

  // Step 3 — run the RegisterSaga (creates identity + credential + USER account + signs in)
  const tokens = await registerSaga.execute({
    verificationId,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    nationality: user.nationality,
    country: user.country,
    username: user.username,
    password: user.password,
  });

  // The saga always creates a USER account. Parse the identityRef from the JWT.
  const payload = JSON.parse(Buffer.from(tokens.accessToken.split('.')[1], 'base64url').toString());
  const identityRef: string = payload.sub;

  // Step 4 — promote to ORGANIZER / ADMIN if needed
  if (user.role === 'ORGANIZER') {
    // Fetch the USER account that was just created, then request+approve ORGANIZER
    const { RequestOrganizerUseCase } = await import('./modules/account/application/use-cases/RequestOrganizer.usecase.js');
    const requestOrganizer = new RequestOrganizerUseCase(accountRepo, deps.accountRepo as any);
    // Use the same repos already wired — just call approve directly via CreateAccountUseCase
    const { CreateAccountUseCase: CAU } = await import('./modules/account/application/use-cases/CreateAccount.usecase.js');
    // Simpler: create the ORGANIZER account directly (bypasses pending flow for seed)
    const accountEventRepo = (accountRepo as any).eventRepo as PostgresAccountEventRepository;
    const createAccount = new CAU(accountRepo, accountEventRepo);
    await createAccount.execute({ identityRef, type: 'ORGANIZER' }).catch(() => {
      // might already exist if re-running seed; tolerated
    });
    // Approve it
    const orgAccount = await accountRepo.findByIdentityRefAndType(
      (await import('./shared/domain/value-objects/IdentityRef.vo.js')).IdentityRef.fromPrimitive(identityRef),
      (await import('./modules/account/domain/value-objects/AccountType.vo.js')).AccountType.organizer(),
    );
    if (orgAccount && !orgAccount.getStatus().isActive()) {
      await approveOrganizer.execute({ accountId: orgAccount.getId().toPrimitive(), callerRef: adminIdentityRef ?? identityRef });
    }
  }

  if (user.role === 'ADMIN') {
    // Bypass CreateAccountUseCase permission check — no existing admin to authorize the first one.
    // Create the ADMIN account directly via the repo.
    const { Account } = await import('./modules/account/domain/entities/Account.entity.js');
    const { AccountId } = await import('./modules/account/domain/value-objects/AccountId.vo.js');
    const { IdentityRef: IR } = await import('./shared/domain/value-objects/IdentityRef.vo.js');
    const existing = await accountRepo.findByIdentityRefAndType(
      IR.fromPrimitive(identityRef),
      (await import('./modules/account/domain/value-objects/AccountType.vo.js')).AccountType.admin(),
    );
    if (!existing) {
      const adminAccount = Account.createAdmin(AccountId.generate(), IR.fromPrimitive(identityRef), IR.fromPrimitive(identityRef));
      await accountRepo.save(adminAccount);
    }
  }

  logger.info({ email: user.email, role: user.role, identityRef }, '[seed] user created');
  return { identityRef, accessToken: tokens.accessToken };
}

async function main() {
  const pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT ?? '5432'),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
  });

  // Run migrations first (idempotent)
  const migrations = new MigrationRunner(pool);
  await migrations.run();

  // ── Wire repos ────────────────────────────────────────────────────────────
  const verificationRepo = new PostgresEmailVerificationRepository(pool);
  const eventRepo = new PostgresEmailEventRepository(pool);
  const hasher = new HmacOtpHasher();
  const generator = new CryptoOtpGenerator();
  const emailSender = new StubEmailSender();
  const txRunner = new PostgresTransactionRunner(pool);

  const credentialRepo = new PostgresCredentialRepository(pool);
  const sessionRepo = new PostgresSessionRepository(pool);
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(process.env.JWT_SECRET ?? 'seed-secret');
  const reservedList = new StaticUsernameReservedList();

  const identityRepo = new PostgresIdentityRepository(pool);

  const accountRepo = new PostgresAccountRepository(pool);
  const accountEventRepo = new PostgresAccountEventRepository(pool);
  const accountQueryAdapter = new PostgresAccountQueryAdapter(pool);

  // Attach eventRepo to accountRepo so seedUser can reach it (hack for seed only)
  (accountRepo as any).eventRepo = accountEventRepo;

  const webhookSender = new HttpWebhookSender(process.env.WEBHOOK_SECRET ?? 'seed-secret');

  // ── Wire use cases ────────────────────────────────────────────────────────
  const requestVerification = new RequestEmailVerificationUseCase(
    verificationRepo, eventRepo, hasher, generator, emailSender,
  );
  const verifyEmail = new VerifyEmailUseCase(verificationRepo, eventRepo, hasher, txRunner);
  const createIdentity = new CreateIdentityUseCase(identityRepo);
  const createCredential = new CreateCredentialUseCase(credentialRepo, passwordHasher, reservedList);
  const createAccount = new CreateAccountUseCase(accountRepo, accountEventRepo);
  const approveOrganizer = new ApproveOrganizerUseCase(accountRepo, accountEventRepo);
  const signIn = new SignInUseCase(credentialRepo, sessionRepo, passwordHasher, tokenService, accountQueryAdapter);

  const registerSaga = new RegisterSaga(
    verificationRepo,
    createIdentity,
    identityRepo,
    createCredential,
    credentialRepo,
    createAccount,
    accountRepo,
    signIn,
    webhookSender,
  );

  // ── Seed ──────────────────────────────────────────────────────────────────
  const results: Record<string, string> = {}; // email -> identityRef
  let adminIdentityRef: string | undefined;

  // Always seed ADMIN first so it can approve ORGANIZER
  const ordered = [...SEED_USERS].sort((a, b) => {
    const priority = { ADMIN: 0, ORGANIZER: 1, USER: 2 };
    return priority[a.role] - priority[b.role];
  });

  for (const user of ordered) {
    try {
      const { identityRef } = await seedUser(user, {
        requestVerification,
        verifyEmail,
        registerSaga,
        emailSender,
        approveOrganizer,
        accountRepo,
        adminIdentityRef,
      });
      results[user.email] = identityRef;
      if (user.role === 'ADMIN') adminIdentityRef = identityRef;
    } catch (err: any) {
      // Idempotency: if user already exists, find and return their identityRef
      if (err?.message?.includes('already') || err?.name?.includes('AlreadyRegistered') || err?.name?.includes('AlreadyTaken')) {
        logger.warn({ email: user.email }, '[seed] user already exists, skipping');
        // Fetch existing identityRef from DB
        const existing = await identityRepo.findByEmail(
          (await import('./shared/domain/value-objects/Email.vo.js')).Email.fromPrimitive(user.email),
        );
        if (existing) {
          results[user.email] = existing.getId().toPrimitive();
          if (user.role === 'ADMIN') adminIdentityRef = results[user.email];
        }
      } else {
        logger.error({ err: err.message, email: user.email }, '[seed] failed');
        throw err;
      }
    }
  }

  // ── Output ─────────────────────────────────────────────────────────────────
  console.log('\n=== chabit-identity seed complete ===');
  console.log(JSON.stringify(results, null, 2));
  console.log('\nPaste the above into backend-chabit/.env as:');
  console.log(`SEED_IDENTITY_ADMIN=${results['admin@example.com'] ?? ''}`);
  console.log(`SEED_IDENTITY_ORGANIZER=${results['organizer@example.com'] ?? ''}`);
  console.log(`SEED_IDENTITY_USER=${results['user@example.com'] ?? ''}`);

  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, '[seed] fatal error');
  process.exit(1);
});

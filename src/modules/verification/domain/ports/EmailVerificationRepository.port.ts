import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { EmailVerification } from '../entities/EmailVerification.entity.js';
import { VerificationId } from '../value-objects/VerificationId.vo.js';

export interface EmailVerificationRepository {
  /**
   * Persists a verification.
   * Pass `tx` (a PoolClient) when this call must participate in an existing transaction.
   */
  save(verification: EmailVerification, tx?: unknown): Promise<void>;
  findLatestByEmail(email: Email): Promise<EmailVerification | null>;
  /**
   * SELECT FOR UPDATE — must always be called with a transaction client (`tx`).
   * The lock is only meaningful inside an active transaction.
   */
  findPendingByEmailForUpdate(email: Email, tx: unknown): Promise<EmailVerification | null>;
  findById(id: VerificationId): Promise<EmailVerification | null>;
  countByEmailInLastHour(email: Email): Promise<number>;
}

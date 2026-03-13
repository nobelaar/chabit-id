import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { EmailVerification } from '../../domain/entities/EmailVerification.entity.js';
import { VerificationId } from '../../domain/value-objects/VerificationId.vo.js';
import { EmailVerificationRepository } from '../../domain/ports/EmailVerificationRepository.port.js';

export class InMemoryEmailVerificationRepository implements EmailVerificationRepository {
  private readonly store: Map<number, EmailVerification> = new Map();
  private nextId = 1;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(verification: EmailVerification, _tx?: unknown): Promise<void> {
    const p = verification.toPrimitive();

    if (p.id === undefined) {
      const id = this.nextId++;
      verification.assignId(VerificationId.fromPrimitive(id));
    }

    this.store.set(verification.getId().toPrimitive(), verification);
  }

  async findLatestByEmail(email: Email): Promise<EmailVerification | null> {
    const matching = [...this.store.values()].filter(
      (v) => v.getEmail().toPrimitive() === email.toPrimitive(),
    );
    if (matching.length === 0) return null;
    return matching.sort(
      (a, b) => b.getSentAt().getTime() - a.getSentAt().getTime(),
    )[0];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findPendingByEmailForUpdate(email: Email, _tx: unknown): Promise<EmailVerification | null> {
    const matching = [...this.store.values()].filter(
      (v) =>
        v.getEmail().toPrimitive() === email.toPrimitive() &&
        v.getStatus().isPending(),
    );
    if (matching.length === 0) return null;
    return matching.sort(
      (a, b) => b.getSentAt().getTime() - a.getSentAt().getTime(),
    )[0];
  }

  async findById(id: VerificationId): Promise<EmailVerification | null> {
    return this.store.get(id.toPrimitive()) ?? null;
  }

  async countByEmailInLastHour(email: Email): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return [...this.store.values()].filter(
      (v) =>
        v.getEmail().toPrimitive() === email.toPrimitive() &&
        v.getSentAt() > oneHourAgo,
    ).length;
  }
}

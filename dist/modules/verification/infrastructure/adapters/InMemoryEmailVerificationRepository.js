import { VerificationId } from '../../domain/value-objects/VerificationId.vo.js';
export class InMemoryEmailVerificationRepository {
    store = new Map();
    nextId = 1;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async save(verification, _tx) {
        const p = verification.toPrimitive();
        if (p.id === undefined) {
            const id = this.nextId++;
            verification.assignId(VerificationId.fromPrimitive(id));
        }
        this.store.set(verification.getId().toPrimitive(), verification);
    }
    async findLatestByEmail(email) {
        const matching = [...this.store.values()].filter((v) => v.getEmail().toPrimitive() === email.toPrimitive());
        if (matching.length === 0)
            return null;
        return matching.sort((a, b) => b.getSentAt().getTime() - a.getSentAt().getTime())[0];
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async findPendingByEmailForUpdate(email, _tx) {
        const matching = [...this.store.values()].filter((v) => v.getEmail().toPrimitive() === email.toPrimitive() &&
            v.getStatus().isPending());
        if (matching.length === 0)
            return null;
        return matching.sort((a, b) => b.getSentAt().getTime() - a.getSentAt().getTime())[0];
    }
    async findById(id) {
        return this.store.get(id.toPrimitive()) ?? null;
    }
    async countByEmailInLastHour(email) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return [...this.store.values()].filter((v) => v.getEmail().toPrimitive() === email.toPrimitive() &&
            v.getSentAt() > oneHourAgo).length;
    }
}

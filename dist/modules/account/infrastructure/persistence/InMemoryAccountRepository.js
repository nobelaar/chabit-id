export class InMemoryAccountRepository {
    store = new Map();
    async save(account) { this.store.set(account.getId().toPrimitive(), account); }
    async findById(id) { return this.store.get(id.toPrimitive()) ?? null; }
    async findByIdentityRef(ref) {
        return [...this.store.values()].filter(a => a.getIdentityRef().toPrimitive() === ref.toPrimitive());
    }
    async findByIdentityRefAndType(ref, type) {
        for (const a of this.store.values()) {
            if (a.getIdentityRef().toPrimitive() === ref.toPrimitive() && a.getType().toPrimitive() === type.toPrimitive())
                return a;
        }
        return null;
    }
    async findActiveByIdentityRef(ref) {
        return [...this.store.values()].filter(a => a.getIdentityRef().toPrimitive() === ref.toPrimitive() && a.getStatus().isActive());
    }
    async hardDelete(id) { this.store.delete(id.toPrimitive()); }
}

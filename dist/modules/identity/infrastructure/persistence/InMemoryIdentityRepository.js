export class InMemoryIdentityRepository {
    store = new Map();
    async save(identity) {
        this.store.set(identity.getId().toPrimitive(), identity);
    }
    async findById(id) {
        return this.store.get(id.toPrimitive()) ?? null;
    }
    async findByEmail(email) {
        for (const identity of this.store.values()) {
            if (identity.getEmail().toPrimitive() === email.toPrimitive())
                return identity;
        }
        return null;
    }
    async findByPhone(phone) {
        for (const identity of this.store.values()) {
            if (identity.getPhone().toPrimitive() === phone.toPrimitive())
                return identity;
        }
        return null;
    }
    async hardDelete(id) {
        this.store.delete(id.toPrimitive());
    }
}

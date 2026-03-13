export class InMemoryCredentialRepository {
    store = new Map();
    async save(credential) {
        this.store.set(credential.getId().toPrimitive(), credential);
    }
    async findById(id) {
        return this.store.get(id.toPrimitive()) ?? null;
    }
    async findByUsername(username) {
        for (const c of this.store.values()) {
            if (c.getUsername().toPrimitive() === username.toPrimitive())
                return c;
        }
        return null;
    }
    async findByIdentityRef(ref) {
        for (const c of this.store.values()) {
            if (c.getIdentityRef().toPrimitive() === ref.toPrimitive())
                return c;
        }
        return null;
    }
    async hardDelete(id) {
        this.store.delete(id.toPrimitive());
    }
}

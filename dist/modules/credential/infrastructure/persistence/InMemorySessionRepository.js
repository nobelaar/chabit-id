export class InMemorySessionRepository {
    store = new Map();
    async save(session) {
        this.store.set(session.getId().toPrimitive(), session);
    }
    async findByUpdateToken(token) {
        for (const s of this.store.values()) {
            if (s.getUpdateToken().toPrimitive() === token.toPrimitive())
                return s;
        }
        return null;
    }
    async findAllByCredentialId(credentialId) {
        return [...this.store.values()].filter(s => s.getCredentialId().toPrimitive() === credentialId.toPrimitive());
    }
    async deleteById(id) {
        this.store.delete(id.toPrimitive());
    }
    async deleteAllByCredentialId(credentialId) {
        for (const [key, s] of this.store) {
            if (s.getCredentialId().toPrimitive() === credentialId.toPrimitive())
                this.store.delete(key);
        }
    }
    async deleteAllByCredentialIdExcept(credentialId, exceptSessionId) {
        for (const [key, s] of this.store) {
            if (s.getCredentialId().toPrimitive() === credentialId.toPrimitive() &&
                s.getId().toPrimitive() !== exceptSessionId.toPrimitive()) {
                this.store.delete(key);
            }
        }
    }
    async deleteExpiredByCredentialId(credentialId) {
        for (const [key, s] of this.store) {
            if (s.getCredentialId().toPrimitive() === credentialId.toPrimitive() && s.isExpired()) {
                this.store.delete(key);
            }
        }
    }
    async countActiveByCredentialId(credentialId) {
        return [...this.store.values()].filter(s => s.getCredentialId().toPrimitive() === credentialId.toPrimitive() && !s.isExpired()).length;
    }
    async deleteOldestByCredentialId(credentialId) {
        const sessions = [...this.store.values()]
            .filter(s => s.getCredentialId().toPrimitive() === credentialId.toPrimitive())
            .sort((a, b) => a.getLastUsedAt().getTime() - b.getLastUsedAt().getTime());
        if (sessions.length > 0) {
            this.store.delete(sessions[0].getId().toPrimitive());
        }
    }
}

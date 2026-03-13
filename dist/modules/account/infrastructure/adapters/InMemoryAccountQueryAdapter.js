export class InMemoryAccountQueryAdapter {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async getAccountsByIdentityRef(ref) {
        const accounts = await this.repo.findActiveByIdentityRef(ref);
        return accounts.map(a => ({
            id: a.getId().toPrimitive(),
            type: a.getType().toPrimitive(),
            status: a.getStatus().toPrimitive(),
        }));
    }
}

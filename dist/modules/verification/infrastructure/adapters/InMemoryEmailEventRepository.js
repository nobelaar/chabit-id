export class InMemoryEmailEventRepository {
    events = [];
    async save(event) {
        this.events.push(event);
    }
    getAll() {
        return [...this.events];
    }
}

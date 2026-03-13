import { EmailEventPrimitive, EmailEventRepository } from '../../domain/ports/EmailEventRepository.port.js';

export class InMemoryEmailEventRepository implements EmailEventRepository {
  private readonly events: EmailEventPrimitive[] = [];

  async save(event: EmailEventPrimitive): Promise<void> {
    this.events.push(event);
  }

  getAll(): EmailEventPrimitive[] {
    return [...this.events];
  }
}

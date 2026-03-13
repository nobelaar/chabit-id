import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';
import { SessionId } from '../../domain/value-objects/SessionId.vo.js';

export interface RevokeTokenDto { sessionId: string; }

export class RevokeTokenUseCase {
  constructor(private readonly sessionRepo: SessionRepository) {}

  async execute(dto: RevokeTokenDto): Promise<void> {
    await this.sessionRepo.deleteById(SessionId.fromPrimitive(dto.sessionId));
  }
}

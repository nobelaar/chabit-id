import { SessionId } from '../../domain/value-objects/SessionId.vo.js';
export class RevokeTokenUseCase {
    sessionRepo;
    constructor(sessionRepo) {
        this.sessionRepo = sessionRepo;
    }
    async execute(dto) {
        await this.sessionRepo.deleteById(SessionId.fromPrimitive(dto.sessionId));
    }
}

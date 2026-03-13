import { IdentityId } from '../value-objects/IdentityId.vo.js';
import { FullName } from '../value-objects/FullName.vo.js';
import { Nationality } from '../value-objects/Nationality.vo.js';
import { Country } from '../value-objects/Country.vo.js';
import { BlnkIdentityRef } from '../value-objects/BlnkIdentityRef.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { BlnkRefAlreadyAssignedError, EmailNotVerifiedError } from '../errors/Identity.errors.js';
export class Identity {
    id;
    fullName;
    email;
    phone;
    nationality;
    country;
    blnkIdentityRef;
    emailVerifiedAt;
    createdAt;
    updatedAt;
    constructor(props) {
        this.id = props.id;
        this.fullName = props.fullName;
        this.email = props.email;
        this.phone = props.phone;
        this.nationality = props.nationality;
        this.country = props.country;
        this.blnkIdentityRef = props.blnkIdentityRef;
        this.emailVerifiedAt = props.emailVerifiedAt;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    static create(props) {
        if (!props.emailVerifiedAt)
            throw new EmailNotVerifiedError();
        const now = new Date();
        return new Identity({
            ...props,
            blnkIdentityRef: undefined,
            createdAt: now,
            updatedAt: now,
        });
    }
    static fromPrimitive(data) {
        return new Identity({
            id: IdentityId.fromPrimitive(data.id),
            fullName: FullName.fromPrimitive(data.fullName),
            email: Email.fromPrimitive(data.email),
            phone: PhoneNumber.fromPrimitive(data.phone),
            nationality: Nationality.fromPrimitive(data.nationality),
            country: Country.fromPrimitive(data.country),
            blnkIdentityRef: data.blnkIdentityRef ? BlnkIdentityRef.fromPrimitive(data.blnkIdentityRef) : undefined,
            emailVerifiedAt: data.emailVerifiedAt,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        });
    }
    assignBlnkRef(ref) {
        if (this.blnkIdentityRef !== undefined)
            throw new BlnkRefAlreadyAssignedError();
        this.blnkIdentityRef = ref;
        this.updatedAt = new Date();
    }
    updateProfile(props) {
        if (props.fullName)
            this.fullName = props.fullName;
        if (props.phone)
            this.phone = props.phone;
        if (props.nationality)
            this.nationality = props.nationality;
        if (props.country)
            this.country = props.country;
        this.updatedAt = new Date();
    }
    getId() { return this.id; }
    getEmail() { return this.email; }
    getPhone() { return this.phone; }
    getFullName() { return this.fullName; }
    getNationality() { return this.nationality; }
    getCountry() { return this.country; }
    getBlnkIdentityRef() { return this.blnkIdentityRef; }
    getEmailVerifiedAt() { return this.emailVerifiedAt; }
    getCreatedAt() { return this.createdAt; }
    getUpdatedAt() { return this.updatedAt; }
    toPrimitive() {
        return {
            id: this.id.toPrimitive(),
            fullName: this.fullName.toPrimitive(),
            email: this.email.toPrimitive(),
            phone: this.phone.toPrimitive(),
            nationality: this.nationality.toPrimitive(),
            country: this.country.toPrimitive(),
            blnkIdentityRef: this.blnkIdentityRef?.toPrimitive(),
            emailVerifiedAt: this.emailVerifiedAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}

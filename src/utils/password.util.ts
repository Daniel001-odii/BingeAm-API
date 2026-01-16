import bcrypt from 'bcryptjs';

export const hashPassword = async (password: string): Promise<any> => {
    return await bcrypt.hash(password, 12);
};

export const comparePassword = async (
    candidatePassword: string,
    hashedPassword: string
): Promise<any> => {
    return await bcrypt.compare(candidatePassword, hashedPassword);
};

export const generateResetToken = (): string => {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
};
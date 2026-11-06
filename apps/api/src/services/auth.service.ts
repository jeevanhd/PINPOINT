import argon2 from 'argon2';
import type { AuthResponse, LoginInput, SignupInput, UserDto } from '@pinpoint/shared';
import { DEFAULT_PASS_MARK } from '@pinpoint/shared';
import { conflict, unauthorized } from '../lib/errors';
import { signAccessToken } from '../lib/jwt';
import { userRepository } from '../repositories/user.repository';
import type { User } from '@prisma/client';

export function toUserDto(user: User): UserDto {
  return { id: user.id, name: user.name, email: user.email, passMark: user.passMark };
}

export const authService = {
  async signup(input: SignupInput): Promise<AuthResponse> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw conflict('That email already has an account');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      passMark: DEFAULT_PASS_MARK,
    });
    return { token: signAccessToken(user.id), user: toUserDto(user) };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) throw unauthorized('Email or password is not right');
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw unauthorized('Email or password is not right');
    return { token: signAccessToken(user.id), user: toUserDto(user) };
  },

  async me(userId: string): Promise<UserDto> {
    const user = await userRepository.findById(userId);
    if (!user) throw unauthorized();
    return toUserDto(user);
  },

  async updateMe(userId: string, data: { name?: string; passMark?: number }): Promise<UserDto> {
    const user = await userRepository.update(userId, data);
    return toUserDto(user);
  },
};

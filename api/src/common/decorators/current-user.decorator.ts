import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user; // This is populated by your JwtStrategy validate()

    // If you use @CurrentUser('id'), it returns just the ID.
    // Otherwise, @CurrentUser() returns the whole user object.
    return data ? user?.[data] : user;
  },
);
import {
  UnsupportedMediaTypeException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common'
import type { Request } from 'express'

/**
 * Cart mutations that carry a body must be JSON. A cross-site page can submit a top-level
 * `<form>` POST as urlencoded/multipart/text-plain without a CORS preflight; the SameSite=Lax
 * cookie isn't sent, so the server would start from an empty cart and the browser would accept
 * the Set-Cookie, replacing the shopper's cart. A cross-site page can't send
 * `application/json` without a preflight, so requiring it closes that hole.
 *
 * This is a per-route guard rather than removing Nest's urlencoded parser in `configureApp()`:
 * it states the rule where it applies, answers with an explicit 415, and doesn't depend on which
 * parsers happen to be registered.
 */
@Injectable()
export class JsonOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()
    if (!req.is('application/json')) {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json')
    }
    return true
  }
}

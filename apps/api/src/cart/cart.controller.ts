import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { CART_COOKIE, cartCookieOptions, decodeCart, encodeCart } from './cart.cookie'
import { JsonOnlyGuard } from './json-only.guard'
import { addItemSchema, parseBody, setQuantitySchema } from './cart.schemas'
import { CartService, type CartResult } from './cart.service'
import type { Cart, CartLine } from './cart.types'

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async get(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<Cart> {
    const raw: unknown = req.cookies?.[CART_COOKIE]
    const result = await this.cartService.view(decodeCart(raw))
    if (raw !== undefined && raw !== encodeCart(result.lines)) {
      writeCookie(res, result)
    }
    return result.cart
  }

  @Post('items')
  @UseGuards(JsonOnlyGuard)
  @HttpCode(200)
  async add(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
  ): Promise<Cart> {
    const { productId, quantity } = parseBody(addItemSchema, body)
    const result = await this.cartService.add(readLines(req), productId, quantity)
    writeCookie(res, result)
    return result.cart
  }

  @Put('items/:productId')
  @UseGuards(JsonOnlyGuard)
  async setQuantity(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ): Promise<Cart> {
    const { quantity } = parseBody(setQuantitySchema, body)
    const result = await this.cartService.setQuantity(readLines(req), productId, quantity)
    writeCookie(res, result)
    return result.cart
  }

  @Delete('items/:productId')
  async remove(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('productId') productId: string,
  ): Promise<Cart> {
    const result = await this.cartService.remove(readLines(req), productId)
    writeCookie(res, result)
    return result.cart
  }
}

function readLines(req: Request): CartLine[] {
  return decodeCart(req.cookies?.[CART_COOKIE])
}

function writeCookie(res: Response, result: CartResult): void {
  res.cookie(CART_COOKIE, encodeCart(result.lines), cartCookieOptions())
}

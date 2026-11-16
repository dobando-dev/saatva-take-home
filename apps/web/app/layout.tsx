import type { Metadata } from 'next'
import { Questrial, Source_Serif_4 } from 'next/font/google'
import { CartProvider } from '@/components/cart/CartProvider'
import { Header } from '@/components/Header'
import { serverGet } from '@/lib/server-api'
import type { Cart } from '@/lib/types'
import './globals.css'

const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' })
const body = Questrial({ subsets: ['latin'], weight: '400', variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Saatva | Choose Your Mattress',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cart = await serverGet<Cart>('/api/cart').catch(() => null)

  return (
    <html lang="en" className={`${serif.variable} ${body.variable}`}>
      <body>
        <CartProvider initialCart={cart}>
          <Header />
          <main>{children}</main>
        </CartProvider>
      </body>
    </html>
  )
}

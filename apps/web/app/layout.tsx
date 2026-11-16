import type { Metadata } from 'next'
import { Questrial, Source_Serif_4 } from 'next/font/google'
import { unstable_rethrow } from 'next/navigation'
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

async function loadCart(): Promise<Cart | null> {
  try {
    return await serverGet<Cart>('/api/cart')
  } catch (error) {
    // Let Next's own control-flow errors (e.g. dynamic-rendering signals) through.
    unstable_rethrow(error)
    return null
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cart = await loadCart()

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

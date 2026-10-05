import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { summarizeCart, type CartLine, type CartSummary } from '@/domain/cart';

const STORAGE_KEY = 'gamestore.cart';

type CartValue = {
  lines: CartLine[];
  summary: CartSummary;
  discountCents: number;
  couponCode: string;
  add: (line: CartLine) => void;
  remove: (gameId: string) => void;
  setCoupon: (code: string, discountCents: number) => void;
  clearCoupon: () => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discountCents, setDiscountCents] = useState(0);
  const [couponCode, setCouponCode] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed)) setLines(parsed.filter((line) => line?.gameId && line.title));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => undefined);
  }, [lines]);

  const summary = summarizeCart(lines, discountCents);
  const value = useMemo<CartValue>(() => ({
    lines,
    summary,
    discountCents: summary.discountCents,
    couponCode,
    add: (line) => {
      setLines((current) => current.some((item) => item.gameId === line.gameId) ? current : [...current, line]);
      setDiscountCents(0);
      setCouponCode('');
    },
    remove: (gameId) => {
      setLines((current) => current.filter((item) => item.gameId !== gameId));
      setDiscountCents(0);
      setCouponCode('');
    },
    setCoupon: (code, discount) => {
      setCouponCode(code.trim());
      setDiscountCents(discount);
    },
    clearCoupon: () => {
      setCouponCode('');
      setDiscountCents(0);
    },
    clear: () => {
      setLines([]);
      setCouponCode('');
      setDiscountCents(0);
    },
  }), [lines, summary, couponCode]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('Carrinho indisponível.');
  return value;
}

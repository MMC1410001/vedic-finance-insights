const KEY = "vedicfinance:payment:v1";

export type PaymentStatus = "idle" | "processing" | "success" | "failed";
export type PaymentMethod = "upi" | "card" | "netbanking";

export type PaymentRecord = {
  status: PaymentStatus;
  method?: PaymentMethod;
  txnId?: string;
  amount: number;
  paidAt?: string;
};

export const loadPayment = (): PaymentRecord | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PaymentRecord) : null;
  } catch {
    return null;
  }
};

export const savePayment = (r: PaymentRecord) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* noop */
  }
};

export const clearPayment = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};

export const hasPaid = (): boolean => {
  const record = loadPayment();
  return record?.status === "success";
};

export const generateTxnId = () =>
  "AFN" +
  Date.now().toString(36).toUpperCase() +
  Math.random().toString(36).slice(2, 6).toUpperCase();

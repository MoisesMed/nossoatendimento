import { create } from 'zustand';

type TenantOption = {
  label: string;
  value: string;
};

type TenantState = {
  tenant: TenantOption | null;
  setTenant: (tenant: TenantOption | null) => void;
};

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  setTenant: (tenant) => set({ tenant }),
}));

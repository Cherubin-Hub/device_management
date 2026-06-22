import { createContext, useContext } from "react";

export const AppToastContext = createContext(null);

export function useAppToast() {
  const context = useContext(AppToastContext);
  if (!context) {
    return { showToast: () => {} };
  }
  return context;
}

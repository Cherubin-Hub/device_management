import { Alert, Snackbar } from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { AppToastContext } from "../lib/appToast.js";

export function AppToastProvider({ children }) {
  const [toast, setToast] = useState({
    message: "",
    open: false,
    severity: "info",
  });

  const showToast = useCallback((message, severity = "info") => {
    setToast({ message, open: true, severity });
  }, []);

  const closeToast = useCallback((_, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setToast((current) => ({ ...current, open: false }));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <AppToastContext.Provider value={value}>
      {children}
      <Snackbar
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        autoHideDuration={3600}
        onClose={closeToast}
        open={toast.open}
      >
        <Alert onClose={closeToast} severity={toast.severity} variant="filled" sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </AppToastContext.Provider>
  );
}

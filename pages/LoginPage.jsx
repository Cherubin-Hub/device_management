// Login handles Supabase authentication and blocks inactive or unauthorized users before the app shell loads.
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import { useState } from "react";
import { supabase } from "../src/lib/supabase.js";

export default function LoginPage({ mode, onLogin, onToggleMode }) {
  // Store email and password locally until the user submits the login form.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Store login errors so Supabase messages can be shown inside the page.
  const [error, setError] = useState("");
  // Track form submission to disable the button and show loading feedback.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    // Prevent the browser from refreshing the page on form submit.
    event.preventDefault();
    setError("");

    if (!supabase) {
      // Stop early when environment variables are missing.
      setError("Supabase is not configured. Please check the environment variables.");
      return;
    }

    setIsSubmitting(true);
    // Ask Supabase Auth to validate the email and password against existing users.
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (signInError) {
      // Keep the user on the login page and show the authentication error.
      setError(signInError.message || "Invalid email or password.");
      return;
    }

    // Pass the valid session back to App so the protected pages can render.
    onLogin?.(data.session);
  };

  return (
    <Box
      component="main"
      sx={{
        alignItems: "center",
        bgcolor: "background.default",
        display: "flex",
        minHeight: "100svh",
        p: 2,
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          maxWidth: 430,
          p: { xs: 2.5, sm: 3 },
          width: "100%",
        }}
      >
        <Stack spacing={2.25}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: "#e8f2ff",
                  borderRadius: 1.5,
                  color: "#1f5f99",
                  display: "flex",
                  height: 42,
                  justifyContent: "center",
                  width: 42,
                }}
              >
                <Inventory2RoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900}>
                  Endivio
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Device Management
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {mode === "dark" ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
              <Switch checked={mode === "dark"} onChange={onToggleMode} size="small" />
            </Stack>
          </Stack>

          <Box>
            <Typography variant="h6" fontWeight={900}>
              Sign in to continue
            </Typography>
          </Box>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack component="form" spacing={1.75} onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={isSubmitting ? <CircularProgress color="inherit" size={16} /> : <LoginRoundedIcon />}
              disabled={isSubmitting || !email.trim() || !password}
              sx={{ fontWeight: 800, minHeight: 42, textTransform: "none" }}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

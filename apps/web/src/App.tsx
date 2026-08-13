import { useEffect, useState } from "react";
import { Center, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { motion } from "framer-motion";
import { api, clearToken, getToken, setToken } from "./api";
import { theme } from "./theme";
import { AuthScreen } from "./components/AuthScreen";
import { VaultShell } from "./components/VaultShell";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";

function useHasPassword() {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((j: { hasPassword: boolean }) => setHas(j.hasPassword))
      .catch(() => setHas(false));
  }, []);
  return has;
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <AppInner />
    </MantineProvider>
  );
}

function AppInner() {
  const has = useHasPassword();
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api<{ ok: boolean }>("/api/auth/me")
      .then(() => setAuthed(true))
      .catch(() => {
        clearToken();
        setAuthed(false);
      });
  }, []);

  if (has === null) {
    return (
      <Center h="100vh" c="dimmed">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Opening vault…
        </motion.div>
      </Center>
    );
  }
  if (has && !authed) {
    return (
      <AuthScreen
        onAuth={(t) => {
          setToken(t);
          setAuthed(true);
        }}
      />
    );
  }
  return (
    <VaultShell
      onLogout={() => {
        clearToken();
        setAuthed(false);
      }}
    />
  );
}

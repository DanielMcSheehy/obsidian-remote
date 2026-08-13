import { useState } from "react";
import { Box, Button, Card, Stack, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDiamond, IconLock, IconSparkles } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import { spring } from "../theme";

export function AuthScreen({ onAuth }: { onAuth: (token: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await api<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password: pw }) });
      onAuth(r.token);
      notifications.show({ title: "Unlocked", message: "Welcome to your vault", color: "violet" });
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "#09090d" }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0.45 }}
        animate={{ scale: 1.05, opacity: 0.75 }}
        transition={{ duration: 5, repeat: Infinity, repeatType: "reverse" }}
        style={{ position: "absolute", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed55, transparent 70%)", top: -180, left: -140, filter: "blur(48px)" }}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0.35 }}
        animate={{ scale: 1.12, opacity: 0.6 }}
        transition={{ duration: 6.5, repeat: Infinity, repeatType: "reverse", delay: 0.6 }}
        style={{ position: "absolute", width: 720, height: 720, borderRadius: "50%", background: "radial-gradient(circle, #ec489955, transparent 70%)", bottom: -240, right: -180, filter: "blur(48px)" }}
      />
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} style={{ position: "relative", zIndex: 1 }}>
        <Card className="glass-strong" shadow="xl" radius="xl" padding="xl" withBorder style={{ width: 440, borderColor: "rgba(124,58,237,0.32)" }}>
          <Stack align="center" gap="xs" mb="lg">
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.12 }}>
              <ThemeIcon size={72} radius="xl" variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ boxShadow: "0 0 34px rgba(124,58,237,0.5)" }}>
                <IconDiamond size={40} />
              </ThemeIcon>
            </motion.div>
            <Title order={2} style={{ letterSpacing: -1, background: "linear-gradient(90deg, #fff, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Obsidian Remote
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              The vault <Text span c="violet" fw={600}>is</Text> the site.
              <br />
              <Text span c="violet" fw={600}>obsidian.swarmlaboratory.com</Text>
              <br />
              Enter <Text span ff="monospace">APP_PASSWORD</Text> to continue
            </Text>
          </Stack>
          <form onSubmit={submit}>
            <Stack gap="md">
              <TextInput
                type="password"
                placeholder="APP_PASSWORD"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                leftSection={<IconLock size={16} />}
                size="md"
                radius="md"
                autoFocus
                required
                styles={{ input: { background: "rgba(15,15,16,0.8)", borderColor: "rgba(124,58,237,0.3)" } }}
              />
              <AnimatePresence>
                {err && (
                  <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }}>
                    <Text c="red" size="sm" ta="center" style={{ background: "rgba(239,68,68,0.1)", padding: 8, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
                      {err}
                    </Text>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button type="submit" loading={loading} size="md" radius="md" fullWidth leftSection={<IconSparkles size={18} />} variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>
                  Unlock vault
                </Button>
              </motion.div>
            </Stack>
          </form>
          <Text c="dimmed" size="xs" ta="center" mt="md" style={{ opacity: 0.5 }}>
            CouchDB is internal only · files live on <Text span ff="monospace">/data/vault</Text>
          </Text>
        </Card>
      </motion.div>
    </Box>
  );
}

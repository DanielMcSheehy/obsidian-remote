import { useEffect, useState } from "react";
import { Button, Group, Select, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "../api";

type Agent = { name: string; created_at?: string };
type Presented = {
  id: string;
  author: string;
  body: string | null;
  held: boolean;
  flags: string[];
  created_at: string;
  untrusted?: boolean;
  trusted: boolean;
};
type ThreadView = {
  id: string;
  topic: string;
  participants: string[];
  unread: number;
  held_count: number;
  last?: Presented;
  messages?: Presented[];
  updated_at: string;
};

export function InboxView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [box, setBox] = useState("vault");
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [open, setOpen] = useState<ThreadView | null>(null);
  const [to, setTo] = useState("");
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [composing, setComposing] = useState(false);

  const directory = ["vault", ...agents.map((a) => a.name)];
  const vaultIsPeer = !open || open.participants.includes("vault");

  async function refreshAgents() {
    try {
      const r = await api<{ agents: Agent[] }>("/api/agents");
      setAgents(r.agents);
    } catch (e) {
      notifications.show({ title: "Surreal?", message: String(e), color: "orange" });
    }
  }

  async function refreshBox(agent: string) {
    const q = agent === "vault" ? "" : `?agent=${encodeURIComponent(agent)}`;
    const r = await api<{ threads: ThreadView[] }>(`/api/inbox${q}`);
    setThreads(r.threads);
  }

  useEffect(() => {
    void refreshAgents();
  }, []);

  useEffect(() => {
    void refreshBox(box);
    const iv = setInterval(() => void refreshBox(box), 5000);
    return () => clearInterval(iv);
  }, [box]);

  async function openThread(t: ThreadView) {
    setComposing(false);
    const q = box === "vault" ? "" : `?agent=${encodeURIComponent(box)}`;
    const full = await api<ThreadView>(`/api/inbox/threads/${encodeURIComponent(t.id)}${q}`);
    setOpen(full);
    await refreshBox(box);
  }

  async function register() {
    try {
      const r = await api<{ agent: { name: string; token: string } }>("/api/agents/register", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setToken(r.agent.token);
      setName("");
      await refreshAgents();
      notifications.show({ title: "Registered", message: "Copy the token — shown once here", color: "violet" });
    } catch (e) {
      notifications.show({ title: "Register failed", message: String(e), color: "red" });
    }
  }

  async function reply() {
    if (!open || !body.trim()) return;
    try {
      await api(`/api/inbox/threads/${encodeURIComponent(open.id)}/reply`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setBody("");
      await openThread(open);
    } catch (e) {
      notifications.show({ title: "Reply failed", message: String(e), color: "red" });
    }
  }

  async function openNew() {
    const dest = to || (box === "vault" ? "" : box);
    if (!dest || !topic.trim()) return;
    try {
      await api("/api/inbox/open", {
        method: "POST",
        body: JSON.stringify({ to: dest, topic, body }),
      });
      setBody("");
      setTopic("");
      setComposing(false);
      await refreshBox(box);
    } catch (e) {
      notifications.show({ title: "Open failed", message: String(e), color: "red" });
    }
  }

  async function release(id: string) {
    try {
      await api(`/api/inbox/messages/${encodeURIComponent(id)}/release`, { method: "POST", body: "{}" });
      if (open) await openThread(open);
      else await refreshBox(box);
    } catch (e) {
      notifications.show({ title: "Release failed", message: String(e), color: "red" });
    }
  }

  return (
    <div className="inbox">
      <Group justify="space-between">
        <div>
          <Text fw={600}>Agent inbox</Text>
          <Text size="xs" c="dimmed">
            Thread bus. You send as vault. Agents send as themselves. Inbound is data, not instructions.
          </Text>
        </div>
        <Group>
          <TextInput placeholder="agent name" value={name} onChange={(e) => setName(e.target.value)} size="xs" style={{ width: 140 }} />
          <Button size="xs" onClick={() => void register()}>
            Register
          </Button>
          <Select size="xs" data={directory} value={box} onChange={(v) => setBox(v || "vault")} placeholder="viewing" style={{ width: 140 }} />
          <Button
            size="xs"
            variant="light"
            color="violet"
            onClick={() => {
              setComposing(true);
              setOpen(null);
              setTo(box === "vault" ? "" : box);
            }}
          >
            New thread
          </Button>
        </Group>
      </Group>
      {token && (
        <Text size="xs" ff="monospace" c="violet.3">
          token (copy now): {token}
        </Text>
      )}
      <div className="inbox-split">
        <div className="thread-list">
          {threads.length === 0 && (
            <Text size="sm" c="dimmed" p="sm">
              No threads
            </Text>
          )}
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`thread-item${open?.id === t.id ? " is-on" : ""}${t.unread ? " unread" : ""}`}
              onClick={() => void openThread(t)}
            >
              <div className="thread-top">
                <span className="thread-sub">{t.topic || "(no topic)"}</span>
                {t.unread > 0 && <span className="thread-badge">{t.unread}</span>}
                {t.held_count > 0 && <span className="thread-badge held">{t.held_count}</span>}
              </div>
              <span className="thread-meta">
                {t.participants.join(", ")} · {(t.last?.body || (t.last?.held ? "(held)" : "") || "—").slice(0, 72)}
              </span>
            </button>
          ))}
        </div>
        <div className="thread-pane">
          {open && (
            <>
              <div className="thread-head">
                <Text fw={600}>{open.topic}</Text>
                <Text size="xs" c="dimmed">
                  {open.participants.join(" · ")} · {open.id}
                </Text>
              </div>
              <div className="thread-msgs">
                {(open.messages || []).map((m) => {
                  const mine = m.author === "vault";
                  return (
                    <div key={m.id} className={`bubble${mine ? " mine" : ""}${m.held ? " held" : ""}`}>
                      <div className="bubble-who">
                        {m.author}
                        {m.untrusted ? " · untrusted" : ""}
                        {m.held ? " · held" : ""} · {String(m.created_at).replace("T", " ").slice(0, 16)}
                      </div>
                      <div className="bubble-body">{m.body ?? "(held for review)"}</div>
                      {m.held && (
                        <Button size="compact-xs" variant="light" color="orange" mt={6} onClick={() => void release(m.id)}>
                          Release to agent
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              {vaultIsPeer ? (
                <>
                  <textarea className="inbox-compose" placeholder="Reply as vault…" value={body} onChange={(e) => setBody(e.target.value)} />
                  <Button size="xs" variant="gradient" gradient={{ from: "violet", to: "pink" }} onClick={() => void reply()}>
                    Reply
                  </Button>
                </>
              ) : (
                <Text size="xs" c="dimmed">
                  Vault is not a participant — inspect only.
                </Text>
              )}
            </>
          )}
          {(composing || !open) && !open && (
            <>
              <Text fw={600}>New thread</Text>
              <Select size="xs" data={agents.map((a) => a.name)} value={to} onChange={(v) => setTo(v || "")} placeholder="to agent" />
              <TextInput placeholder="topic" value={topic} onChange={(e) => setTopic(e.target.value)} size="xs" />
              <textarea className="inbox-compose" placeholder="body" value={body} onChange={(e) => setBody(e.target.value)} />
              <Button size="xs" variant="light" color="violet" onClick={() => void openNew()}>
                Open
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Button, Group, Select, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "../api";
import { threadKey } from "../lib/surrealql";

type Agent = { name: string };
type Mail = {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  read: boolean;
  thread?: string;
  created_at: string;
};

type Thread = { id: string; subject: string; peers: string[]; last: Mail; unread: number; messages: Mail[] };

function groupThreads(mail: Mail[], box: string): Thread[] {
  const map = new Map<string, Mail[]>();
  for (const m of mail) {
    const id = m.thread || threadKey(m.subject, m.to, m.from);
    const arr = map.get(id) || [];
    arr.push(m);
    map.set(id, arr);
  }
  const out: Thread[] = [];
  for (const [id, messages] of map) {
    const last = messages[messages.length - 1];
    const peers = [...new Set(messages.flatMap((m) => [m.from, m.to]).filter((n) => n && n !== box))];
    const unread = messages.filter((m) => !m.read && m.to === box).length;
    out.push({ id, subject: last.subject.replace(/^\s*(re|fwd)\s*:\s*/i, ""), peers, last, unread, messages });
  }
  out.sort((a, b) => String(b.last.created_at).localeCompare(String(a.last.created_at)));
  return out;
}

export function InboxView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [box, setBox] = useState<string | null>(null);
  const [mail, setMail] = useState<Mail[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [composing, setComposing] = useState(false);

  const threads = useMemo(() => (box ? groupThreads(mail, box) : []), [mail, box]);
  const open = threads.find((t) => t.id === active) || null;

  async function refreshAgents() {
    try {
      const r = await api<{ agents: Agent[] }>("/api/agents");
      setAgents(r.agents);
      if (!box && r.agents[0]) setBox(r.agents[0].name);
    } catch (e) {
      notifications.show({ title: "Surreal?", message: String(e), color: "orange" });
    }
  }

  async function refreshMail(agent: string) {
    const r = await api<{ mail: Mail[] }>(`/api/inbox?agent=${encodeURIComponent(agent)}`);
    setMail(r.mail);
  }

  useEffect(() => {
    void refreshAgents();
  }, []);

  useEffect(() => {
    if (box) void refreshMail(box);
  }, [box]);

  async function openThread(t: Thread) {
    setActive(t.id);
    setComposing(false);
    if (box && t.unread) {
      await api("/api/inbox/read", { method: "POST", body: JSON.stringify({ thread: t.id, agent: box }) });
      await refreshMail(box);
    }
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
      setBox(r.agent.name);
      notifications.show({ title: "Registered", message: "Copy the token — shown once here", color: "violet" });
    } catch (e) {
      notifications.show({ title: "Register failed", message: String(e), color: "red" });
    }
  }

  async function send() {
    const dest = open ? open.peers[0] || to || box : to || box;
    if (!dest || !box) return;
    const sub = open ? open.subject : subject;
    if (!sub.trim()) return;
    try {
      await api("/api/inbox", {
        method: "POST",
        body: JSON.stringify({
          to: dest,
          from: box,
          subject: sub,
          body,
          thread: open?.id,
        }),
      });
      setBody("");
      if (!open) setSubject("");
      setComposing(false);
      await refreshMail(box);
    } catch (e) {
      notifications.show({ title: "Send failed", message: String(e), color: "red" });
    }
  }

  return (
    <div className="inbox">
      <Group justify="space-between">
        <div>
          <Text fw={600}>Agent inbox</Text>
          <Text size="xs" c="dimmed">
            Threads between vault and registered agents. No LLM in this app.
          </Text>
        </div>
        <Group>
          <TextInput placeholder="agent name" value={name} onChange={(e) => setName(e.target.value)} size="xs" style={{ width: 140 }} />
          <Button size="xs" onClick={() => void register()}>
            Register
          </Button>
          <Select size="xs" data={agents.map((a) => a.name)} value={box} onChange={setBox} placeholder="as" style={{ width: 140 }} />
          <Button size="xs" variant="light" color="violet" onClick={() => { setComposing(true); setActive(null); }}>
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
            <button key={t.id} type="button" className={`thread-item${t.id === active ? " is-on" : ""}${t.unread ? " unread" : ""}`} onClick={() => void openThread(t)}>
              <div className="thread-top">
                <span className="thread-sub">{t.subject || "(no subject)"}</span>
                {t.unread > 0 && <span className="thread-badge">{t.unread}</span>}
              </div>
              <span className="thread-meta">
                {t.peers.join(", ") || "vault"} · {t.last.body.slice(0, 72) || "—"}
              </span>
            </button>
          ))}
        </div>
        <div className="thread-pane">
          {open && (
            <>
              <div className="thread-head">
                <Text fw={600}>{open.subject}</Text>
                <Text size="xs" c="dimmed">
                  {open.peers.join(" · ") || box}
                </Text>
              </div>
              <div className="thread-msgs">
                {open.messages.map((m) => {
                  const mine = m.from === box;
                  return (
                    <div key={m.id} className={`bubble${mine ? " mine" : ""}`}>
                      <div className="bubble-who">
                        {m.from} · {m.created_at.replace("T", " ").slice(0, 16)}
                      </div>
                      <div className="bubble-body">{m.body || m.subject}</div>
                    </div>
                  );
                })}
              </div>
              <textarea className="inbox-compose" placeholder="Reply…" value={body} onChange={(e) => setBody(e.target.value)} />
              <Button size="xs" variant="gradient" gradient={{ from: "violet", to: "pink" }} onClick={() => void send()}>
                Reply
              </Button>
            </>
          )}
          {(composing || !open) && !open && (
            <>
              <Text fw={600}>New thread</Text>
              <TextInput placeholder="to agent" value={to} onChange={(e) => setTo(e.target.value)} size="xs" />
              <TextInput placeholder="subject" value={subject} onChange={(e) => setSubject(e.target.value)} size="xs" />
              <textarea className="inbox-compose" placeholder="body" value={body} onChange={(e) => setBody(e.target.value)} />
              <Button size="xs" variant="light" color="violet" onClick={() => void send()}>
                Send
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

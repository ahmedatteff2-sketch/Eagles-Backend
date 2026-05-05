import { useAuthStore } from "@/store/auth";
import { customFetch } from "@/api-client/custom-fetch";
import { useState, useEffect, useRef } from "react";

const GOLD = "hsl(40 65% 52%)";

interface Contact { id: string; name: string; role: string; unread: number; }
interface Message { id: number; senderId: string; receiverId: string; message: string; read: number; createdAt: string; }

export default function MemberChat() {
  const { user } = useAuthStore();
  const myId = user?.id ?? "";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    customFetch<Contact[]>("/api/chat-contacts")
      .then(d => setContacts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function loadMessages(contact: Contact) {
    setActiveContact(contact);
    customFetch<Message[]>(`/api/chat/${contact.id}`)
      .then(d => { setMessages(Array.isArray(d) ? d : []); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); })
      .catch(() => {});
  }

  useEffect(() => {
    if (!activeContact) return;
    pollRef.current = setInterval(() => {
      customFetch<Message[]>(`/api/chat/${activeContact.id}`)
        .then(d => setMessages(Array.isArray(d) ? d : []))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [activeContact]);

  async function send() {
    if (!input.trim() || !activeContact) return;
    setSending(true);
    try {
      await customFetch(`/api/chat/${activeContact.id}`, {
        method: "POST",
        body: JSON.stringify({ message: input.trim() }),
      });
      setInput("");
      const msgs = await customFetch<Message[]>(`/api/chat/${activeContact.id}`);
      setMessages(Array.isArray(msgs) ? msgs : []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {}
    setSending(false);
  }

  if (loading) return <div className="p-6 text-center"><p className="text-muted-foreground text-sm">جاري التحميل...</p></div>;

  // Chat view
  if (activeContact) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
          <button onClick={() => setActiveContact(null)} className="text-muted-foreground hover:text-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
            style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD }}>
            {activeContact.name?.[0] ?? "?"}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{activeContact.name}</p>
            <p className="text-xs text-muted-foreground">{activeContact.role === "admin" ? "مدرب" : "متدرب"}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">ابدأ المحادثة</p>
            </div>
          )}
          {messages.map(m => {
            const isMe = m.senderId === myId;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${isMe ? "rounded-br-md" : "rounded-bl-md"}`}
                  style={{
                    background: isMe ? "hsl(40 65% 48% / 0.15)" : "hsl(0 0% 12%)",
                    border: `1px solid ${isMe ? "hsl(40 65% 48% / 0.2)" : "hsl(0 0% 16%)"}`,
                  }}>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-left">
                    {new Date(m.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 flex gap-2" style={{ borderTop: "1px solid hsl(0 0% 13%)" }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="اكتب رسالة..."
            className="flex-1 bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={send} disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ background: GOLD, color: "#000" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
      </div>
    );
  }

  // Contacts list
  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">💬 الرسائل</h1>
        <p className="text-muted-foreground text-sm">تواصل مع {user?.role === "admin" ? "المتدربين" : "المدرب"}</p>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">لا يوجد جهات اتصال</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {contacts.map(c => (
            <button key={c.id} onClick={() => loadMessages(c)}
              className="w-full px-4 py-3 flex items-center gap-3 text-right hover:bg-muted/30 transition-colors"
              style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD }}>
                {c.name?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.role === "admin" ? "مدرب" : "متدرب"}</p>
              </div>
              {c.unread > 0 && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: GOLD, color: "#000" }}>{c.unread}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

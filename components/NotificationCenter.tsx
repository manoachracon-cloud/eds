"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NotificationFilter = {
  status: string;
  channel: string;
  severity: string;
  read: string;
  search: string;
};

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function badgeTone(value: string) {
  if (["sent", "success", "paid", "insert"].includes(value)) return "success";
  if (["failed", "error", "delete"].includes(value)) return "danger";
  if (["pending", "warning", "update"].includes(value)) return "warning";
  return "dark";
}

function statusBadge(value: string) {
  return <span className={`badge ${badgeTone(value)}`}>{value}</span>;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };

  const csv = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(";"))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function shortText(value: unknown, max = 160) {
  const text = String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [tab, setTab] = useState<"notifications" | "audit">("notifications");
  const [filters, setFilters] = useState<NotificationFilter>({
    status: "all",
    channel: "all",
    severity: "all",
    read: "all",
    search: ""
  });

  async function adminFetch(url: string, init: RequestInit = {}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    return fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  }

  async function loadData() {
    setLoading(true);
    setNotificationError("");
    setAuditError("");

    const [notificationsResult, auditResult] = await Promise.all([
      supabase
        .from("notifications")
        .select(
          "id,booking_id,client_id,employee_id,channel,recipient,subject,message,status,provider,provider_message_id,sent_at,failed_reason,created_at,event_type,severity,is_read,read_at,metadata,retry_count,last_retry_at,resolved_at,resolution_note,can_retry,retry_parent_id,bookings(booking_reference),clients(first_name,last_name,email,phone),employees(public_display_name,role_title)"
        )
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("audit_logs")
        .select("id,user_id,action,entity_type,entity_id,old_value,new_value,created_at")
        .order("created_at", { ascending: false })
        .limit(300)
    ]);

    if (notificationsResult.error) {
      setNotificationError(notificationsResult.error.message);
    } else {
      setNotifications(notificationsResult.data || []);
    }

    if (auditResult.error) {
      setAuditError(auditResult.error.message);
    } else {
      setAuditLogs(auditResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredNotifications = useMemo(() => {
    const search = filters.search.toLowerCase().trim();

    return notifications.filter((item) => {
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.channel !== "all" && item.channel !== filters.channel) return false;
      if (filters.severity !== "all" && item.severity !== filters.severity) return false;
      if (filters.read === "read" && !item.is_read) return false;
      if (filters.read === "unread" && item.is_read) return false;

      if (search) {
        const haystack = [
          item.subject,
          item.message,
          item.recipient,
          item.provider,
          item.failed_reason,
          item.bookings?.booking_reference,
          item.clients?.first_name,
          item.clients?.last_name,
          item.clients?.email,
          item.employees?.public_display_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [notifications, filters]);

  const stats = useMemo(() => {
    return {
      total: notifications.length,
      unread: notifications.filter((item) => !item.is_read).length,
      failed: notifications.filter((item) => item.status === "failed").length,
      sent: notifications.filter((item) => item.status === "sent").length,
      whatsapp: notifications.filter((item) => item.channel === "whatsapp").length,
      calendar: notifications.filter((item) => item.provider === "google_calendar" || item.channel === "google_calendar").length,
      resolved: notifications.filter((item) => Boolean(item.resolved_at)).length,
      retryable: notifications.filter((item) => item.status === "failed" && item.can_retry !== false && !item.resolved_at).length
    };
  }, [notifications]);

  async function markRead(id: string, isRead = true) {
    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              is_read: isRead,
              read_at: isRead ? new Date().toISOString() : null
            }
          : item
      )
    );
  }

  async function markAllFilteredRead() {
    const ids = filteredNotifications.filter((item) => !item.is_read).map((item) => item.id);

    if (ids.length === 0) {
      alert("Aucune notification non lue dans ce filtre.");
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .in("id", ids);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function retryNotification(notificationId: string) {
    const confirmed = window.confirm("Relancer cette notification échouée ?");

    if (!confirmed) return;

    const response = await adminFetch("/api/notifications/retry", {
      method: "POST",
      body: JSON.stringify({ notificationId })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      alert(result?.failedReason || result?.error || "La relance a échoué.");
      await loadData();
      return;
    }

    alert("Relance réussie.");
    await loadData();
  }

  async function resolveNotification(notificationId: string) {
    const note = window.prompt(
      "Note de résolution :",
      "Erreur traitée manuellement par l’équipe."
    );

    if (note === null) return;

    const response = await adminFetch("/api/notifications/resolve", {
      method: "POST",
      body: JSON.stringify({
        notificationId,
        resolutionNote: note
      })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      alert(result?.error || "Impossible de marquer comme résolu.");
      return;
    }

    await loadData();
  }

  function exportNotifications() {
    downloadCsv(
      "notifications-esthetic-diamonds.csv",
      filteredNotifications.map((item) => ({
        date: item.created_at,
        lu: item.is_read ? "oui" : "non",
        canal: item.channel,
        statut: item.status,
        severite: item.severity,
        provider: item.provider || "",
        destinataire: item.recipient,
        sujet: item.subject || "",
        reservation: item.bookings?.booking_reference || "",
        client: item.clients ? `${item.clients.first_name || ""} ${item.clients.last_name || ""}` : "",
        erreur: item.failed_reason || "",
        relances: item.retry_count || 0,
        derniere_relance: item.last_retry_at || "",
        resolu_le: item.resolved_at || "",
        note_resolution: item.resolution_note || ""
      }))
    );
  }

  function exportAudit() {
    downloadCsv(
      "journal-activite-esthetic-diamonds.csv",
      auditLogs.map((item) => ({
        date: item.created_at,
        action: item.action,
        entite: item.entity_type,
        entite_id: item.entity_id || "",
        user_id: item.user_id || "",
        ancien: JSON.stringify(item.old_value || {}),
        nouveau: JSON.stringify(item.new_value || {})
      }))
    );
  }

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Contrôle opérationnel</div>
          <h1 className="page-title">Centre de notifications</h1>
          <p className="section-desc">
            Suivi des e-mails, WhatsApp, Google Calendar, Stripe, erreurs d’automatisation et actions critiques.
          </p>
        </div>
      </div>

      {loading && <div className="alert">Chargement du centre de notifications...</div>}
      {notificationError && <div className="error">Notifications : {notificationError}</div>}
      {auditError && (
        <div className="alert">
          Journal d’activité non disponible : {auditError}. Vérifie que l’utilisateur connecté a le rôle admin ou super_admin.
        </div>
      )}

      <div className="grid grid-4">
        <Metric label="Notifications" value={stats.total.toString()} />
        <Metric label="Non lues" value={stats.unread.toString()} />
        <Metric label="Échecs" value={stats.failed.toString()} />
        <Metric label="Envoyées" value={stats.sent.toString()} />
        <Metric label="WhatsApp" value={stats.whatsapp.toString()} />
        <Metric label="Google Calendar" value={stats.calendar.toString()} />
        <Metric label="Audit logs" value={auditLogs.length.toString()} />
        <Metric label="Relançables" value={stats.retryable.toString()} />
        <Metric label="Résolues" value={stats.resolved.toString()} />
        <Metric label="Filtrées" value={filteredNotifications.length.toString()} />
      </div>

      <div className="card card-pad" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className={`filter ${tab === "notifications" ? "active" : ""}`} onClick={() => setTab("notifications")}>
              Notifications
            </button>
            <button className={`filter ${tab === "audit" ? "active" : ""}`} onClick={() => setTab("audit")}>
              Journal d’activité
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-light" onClick={loadData}>
              Actualiser
            </button>
            {tab === "notifications" ? (
              <>
                <button className="btn btn-light" onClick={markAllFilteredRead}>
                  Marquer le filtre comme lu
                </button>
                <button className="btn btn-primary" onClick={exportNotifications}>
                  Export notifications
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={exportAudit}>
                Export journal
              </button>
            )}
          </div>
        </div>
      </div>

      {tab === "notifications" && (
        <>
          <div className="card card-pad" style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 28 }}>Filtres</h2>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <label>
                <span>Recherche</span>
                <input
                  className="input"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Client, réservation, erreur, destinataire..."
                />
              </label>
              <label>
                <span>Statut</span>
                <select className="select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="all">Tous</option>
                  <option value="sent">Envoyé</option>
                  <option value="failed">Échec</option>
                  <option value="pending">En attente</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </label>
            </div>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <label>
                <span>Canal</span>
                <select className="select" value={filters.channel} onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}>
                  <option value="all">Tous</option>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="google_calendar">Google Calendar</option>
                  <option value="internal">Interne</option>
                  <option value="sms">SMS</option>
                </select>
              </label>
              <label>
                <span>Lecture</span>
                <select className="select" value={filters.read} onChange={(event) => setFilters((current) => ({ ...current, read: event.target.value }))}>
                  <option value="all">Toutes</option>
                  <option value="unread">Non lues</option>
                  <option value="read">Lues</option>
                </select>
              </label>
            </div>
          </div>

          <div className="table" style={{ marginTop: 22 }}>
            <div className="tr head">
              <span>Date</span>
              <span>Canal</span>
              <span>Notification</span>
              <span>Contexte</span>
              <span>Action</span>
            </div>

            {filteredNotifications.map((item) => (
              <div className="tr" key={item.id} style={{ opacity: item.is_read ? 0.74 : 1 }}>
                <div>
                  <strong>{dateTimeLabel(item.created_at)}</strong>
                  <br />
                  <span className="muted">{item.is_read ? "Lu" : "Non lu"}</span>
                </div>
                <div>
                  {statusBadge(item.channel)}
                  <br />
                  <span style={{ display: "inline-block", marginTop: 6 }}>{statusBadge(item.status)}</span>
                  {item.severity && <span style={{ display: "inline-block", marginTop: 6 }}>{statusBadge(item.severity)}</span>}
                </div>
                <div>
                  <strong>{item.subject || "Sans objet"}</strong>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {shortText(item.message)}
                  </p>
                  {item.failed_reason && (
                    <p className="error" style={{ marginTop: 8 }}>
                      {item.failed_reason}
                    </p>
                  )}
                  {(item.retry_count > 0 || item.resolved_at) && (
                    <p className="muted" style={{ marginTop: 8 }}>
                      Relances : {item.retry_count || 0}
                      {item.last_retry_at ? ` · Dernière relance : ${dateTimeLabel(item.last_retry_at)}` : ""}
                      {item.resolved_at ? ` · Résolu : ${dateTimeLabel(item.resolved_at)}` : ""}
                    </p>
                  )}
                  {item.resolution_note && (
                    <p className="muted" style={{ marginTop: 8 }}>
                      Note : {item.resolution_note}
                    </p>
                  )}
                </div>
                <div className="muted">
                  {item.recipient}
                  <br />
                  {item.provider || "provider non renseigné"}
                  <br />
                  {item.bookings?.booking_reference ? `Réservation : ${item.bookings.booking_reference}` : ""}
                  <br />
                  {item.clients ? `Client : ${item.clients.first_name || ""} ${item.clients.last_name || ""}` : ""}
                </div>
                <div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <button className="btn btn-light" style={{ padding: "8px 12px" }} onClick={() => markRead(item.id, !item.is_read)}>
                      {item.is_read ? "Marquer non lu" : "Marquer lu"}
                    </button>
                    {item.status === "failed" && item.can_retry !== false && !item.resolved_at && (
                      <button className="btn btn-primary" style={{ padding: "8px 12px" }} onClick={() => retryNotification(item.id)}>
                        Relancer
                      </button>
                    )}
                    {item.status === "failed" && !item.resolved_at && (
                      <button className="btn btn-light" style={{ padding: "8px 12px" }} onClick={() => resolveNotification(item.id)}>
                        Marquer résolu
                      </button>
                    )}
                    {item.resolved_at && <span className="badge success">Résolu</span>}
                  </div>
                </div>
              </div>
            ))}

            {filteredNotifications.length === 0 && (
              <div className="alert">Aucune notification ne correspond aux filtres.</div>
            )}
          </div>
        </>
      )}

      {tab === "audit" && (
        <div className="table" style={{ marginTop: 22 }}>
          <div className="tr head">
            <span>Date</span>
            <span>Action</span>
            <span>Entité</span>
            <span>Détail</span>
            <span>Utilisateur</span>
          </div>

          {auditLogs.map((item) => (
            <div className="tr" key={item.id}>
              <div>
                <strong>{dateTimeLabel(item.created_at)}</strong>
              </div>
              <div>{statusBadge(item.action)}</div>
              <div>
                <strong>{item.entity_type}</strong>
                <br />
                <span className="muted">{item.entity_id}</span>
              </div>
              <div className="muted">
                {item.action === "insert" && "Création"}
                {item.action === "update" && "Modification"}
                {item.action === "delete" && "Suppression"}
                <br />
                {item.new_value?.booking_reference ? `Référence : ${item.new_value.booking_reference}` : ""}
                {item.new_value?.name ? `Nom : ${item.new_value.name}` : ""}
                {item.new_value?.title ? `Titre : ${item.new_value.title}` : ""}
                {item.old_value?.status && item.new_value?.status && item.old_value.status !== item.new_value.status
                  ? `Statut : ${item.old_value.status} → ${item.new_value.status}`
                  : ""}
              </div>
              <div className="muted">{item.user_id || "Automatisation / serveur"}</div>
            </div>
          ))}

          {auditLogs.length === 0 && <div className="alert">Aucune activité enregistrée.</div>}
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

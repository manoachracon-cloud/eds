"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { EmployeeOption, EmployeeServiceRow, Service, ServiceCategory } from "@/lib/types";
import { DemoBadge, EmptyState, PremiumNotice, SkeletonGrid } from "@/components/ui/Polish";
import { demoAquasportClasses, demoCategories, demoEmployeeServices, demoServices } from "@/lib/demoData";

const FALLBACK_IMAGE = "https://www.estheticdiamonds.fr/ressources/images/Image-fx-1_3b15_lg.jpeg";
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const defaultSlots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30"
];

type View = "home" | "catalog" | "booking";
type AquasportClass = {
  id: string;
  service_id: string;
  title: string;
  level: string;
  start_at: string;
  end_at: string;
  capacity_max: number;
  registered_count: number;
  waitlist_count: number;
  status: string;
  instructions?: string | null;
  employees?: {
    public_display_name: string;
    role_title: string;
  } | null;
  resources?: {
    name: string;
  } | null;
};

type BookingForm = {
  serviceId: string;
  aquasportClassId: string;
  date: string;
  time: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  comment: string;
  level: string;
  health: string;
  giftCardCode: string;
  consent: boolean;
};

const initialForm: BookingForm = {
  serviceId: "",
  aquasportClassId: "",
  date: "2026-05-04",
  time: "",
  employeeId: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  comment: "",
  level: "débutant",
  health: "",
  giftCardCode: "",
  consent: false
};

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function toGuadeloupeIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-04:00`).toISOString();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00-04:00`));
}

export default function PublicBookingApp() {
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employeeServices, setEmployeeServices] = useState<EmployeeServiceRow[]>([]);
  const [aquasportClasses, setAquasportClasses] = useState<AquasportClass[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [availableSlots, setAvailableSlots] = useState<string[]>(defaultSlots);
  const [submitting, setSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<any | null>(null);
  const [submitError, setSubmitError] = useState("");

  const selectedService = useMemo(
    () => services.find((service) => service.id === form.serviceId) || null,
    [services, form.serviceId]
  );

  const employeesForService = useMemo(() => {
    return employeeServices
      .filter((row) => row.service_id === form.serviceId && row.employees)
      .map((row) => row.employees as EmployeeOption);
  }, [employeeServices, form.serviceId]);

  const selectedAquasportClasses = useMemo(() => {
    return aquasportClasses
      .filter((classItem) => classItem.service_id === form.serviceId)
      .filter((classItem) => ["open", "full", "closed"].includes(classItem.status))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [aquasportClasses, form.serviceId]);

  const selectedAquasportClass = useMemo(
    () => aquasportClasses.find((classItem) => classItem.id === form.aquasportClassId) || null,
    [aquasportClasses, form.aquasportClassId]
  );

  const isAquasportBooking = selectedService?.category?.slug === "aqua-sports";

  const featuredServices = useMemo(
    () => services.filter((service) => service.is_featured).slice(0, 4),
    [services]
  );

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesCategory =
        activeCategory === "all" || service.category?.slug === activeCategory;
      const matchesSearch = service.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [services, activeCategory, search]);

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      setLoadError("");

      if (DEMO_MODE) {
        setCategories(demoCategories);
        setServices(demoServices);
        setEmployeeServices(demoEmployeeServices);
        setAquasportClasses(demoAquasportClasses as AquasportClass[]);
        setLoading(false);
        return;
      }

      const [categoriesResult, servicesResult, employeeServicesResult, aquasportClassesResult] = await Promise.all([
        supabase
          .from("service_categories")
          .select("id,name,slug,description,display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("services")
          .select(
            "id,name,slug,short_description,long_description,duration_minutes,price_cents,service_type,capacity_max,image_url,is_featured,category:service_categories(id,name,slug,description,display_order)"
          )
          .eq("is_active", true)
          .order("is_featured", { ascending: false }),
        supabase
          .from("employee_services")
          .select("service_id, employees(id, public_display_name, role_title)"),
        supabase
          .from("aquasport_classes")
          .select("id,service_id,title,level,start_at,end_at,capacity_max,registered_count,waitlist_count,status,instructions,employees(public_display_name,role_title),resources(name)")
          .gte("start_at", new Date().toISOString())
          .in("status", ["open", "full", "closed"])
          .order("start_at", { ascending: true })
      ]);

      if (categoriesResult.error || servicesResult.error || employeeServicesResult.error || aquasportClassesResult.error) {
        setLoadError(
          categoriesResult.error?.message ||
            servicesResult.error?.message ||
            employeeServicesResult.error?.message ||
            aquasportClassesResult.error?.message ||
            "Erreur de chargement Supabase."
        );
      } else {
        setCategories((categoriesResult.data || []) as ServiceCategory[]);
        setServices((servicesResult.data || []) as unknown as Service[]);
        setEmployeeServices((employeeServicesResult.data || []) as unknown as EmployeeServiceRow[]);
        setAquasportClasses((aquasportClassesResult.data || []) as unknown as AquasportClass[]);
      }

      setLoading(false);
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    async function loadSlots() {
      if (!form.serviceId || !form.date) return;

      const { data, error } = await supabase.rpc("get_public_available_slots", {
        p_service_id: form.serviceId,
        p_employee_id: form.employeeId || null,
        p_date: form.date
      });

      if (error) {
        // La fonction RPC est fournie dans supabase/02_availability_rpc.sql.
        // Si elle n'est pas encore installée, on garde les créneaux par défaut.
        setAvailableSlots(defaultSlots);
        return;
      }

      const slots = (data || []).map((row: any) => row.slot_time);
      setAvailableSlots(slots.length > 0 ? slots : []);
    }

    loadSlots();
  }, [form.serviceId, form.employeeId, form.date]);

  function goTo(target: View) {
    setView(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startBooking(serviceId: string) {
    setForm({ ...initialForm, serviceId, aquasportClassId: "" });
    setCreatedBooking(null);
    setSubmitError("");
    setStep(2);
    goTo("booking");
  }

  function updateField<K extends keyof BookingForm>(key: K, value: BookingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitBooking() {
    setSubmitError("");

    if (DEMO_MODE) {
      setSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, 700));
      setSubmitting(false);
      setCreatedBooking({
        id: "demo-booking",
        booking_reference: "EDS-DEMO-001",
        service: selectedService,
        employee: employeesForService[0] || null,
        selectedTime: isAquasportBooking && selectedAquasportClass ? formatTime(selectedAquasportClass.start_at) : form.time,
        selectedDate: isAquasportBooking && selectedAquasportClass ? selectedAquasportClass.start_at.slice(0, 10) : form.date,
        price_cents: selectedService?.price_cents || 0,
        gift_card_amount_cents: form.giftCardCode ? Math.min(2500, selectedService?.price_cents || 0) : 0,
        payment_due_cents: Math.max((selectedService?.price_cents || 0) - (form.giftCardCode ? 2500 : 0), 0)
      });
      setStep(5);
      return;
    }

    if (!form.firstName || !form.lastName || !form.phone || !form.email || !form.consent) {
      setSubmitError("Merci de remplir les champs obligatoires et d’accepter les conditions.");
      return;
    }

    if (!selectedService) {
      setSubmitError("La prestation sélectionnée est introuvable.");
      return;
    }

    if (!form.time) {
      setSubmitError("Merci de choisir un créneau.");
      return;
    }

    setSubmitting(true);

    if (isAquasportBooking) {
      if (!form.aquasportClassId) {
        setSubmitting(false);
        setSubmitError("Merci de choisir une séance Aqua-sports.");
        return;
      }

      const response = await fetch("/api/aquasport/book-class", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          aquasportClassId: form.aquasportClassId,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email,
          comment: form.comment,
          level: form.level,
          health: form.health,
          consent: form.consent
        })
      });

      const result = await response.json().catch(() => null);
      setSubmitting(false);

      if (!response.ok || !result?.ok) {
        if (result?.waitlistAvailable) {
          setSubmitError(`${result.error} Utilisez le bouton liste d’attente sur la séance.`);
        } else {
          setSubmitError(result?.error || "Impossible de réserver cette séance Aqua-sports.");
        }
        return;
      }

      setCreatedBooking({
        ...result.booking,
        service: selectedService,
        employee: result.booking?.aquasport_class?.employees || null,
        selectedTime: formatTime(result.booking.start_at),
        selectedDate: result.booking.start_at.slice(0, 10),
        aquasportClass: result.booking?.aquasport_class,
        notifications: result.notifications
      });
      setStep(5);
      return;
    }

    const response = await fetch("/api/bookings/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        serviceId: selectedService.id,
        date: form.date,
        time: form.time,
        employeeId: form.employeeId || null,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        comment: form.comment,
        level: form.level,
        health: form.health,
        giftCardCode: form.giftCardCode,
        consent: form.consent
      })
    });

    const result = await response.json().catch(() => null);
    setSubmitting(false);

    if (!response.ok || !result?.ok) {
      setSubmitError(
        result?.error ||
          "Impossible de créer la réservation. Le créneau est peut-être déjà pris."
      );
      return;
    }

    const fallbackEmployeeId = form.employeeId || null;

    setCreatedBooking({
      ...result.booking,
      service: selectedService,
      employee:
        employeesForService.find((employee) => employee.id === fallbackEmployeeId) ||
        result.booking?.employees ||
        null,
      selectedTime: form.time,
      selectedDate: form.date,
      notifications: result.notifications
    });
    setStep(5);
  }

  async function joinWaitlist(classId: string) {
    setSubmitError("");

    if (DEMO_MODE) {
      alert("Mode démonstration : vous avez été ajouté à la liste d’attente fictive.");
      return;
    }

    if (!form.firstName || !form.lastName || !form.phone || !form.email) {
      setSubmitError("Pour rejoindre la liste d’attente, renseignez d’abord vos informations client.");
      setStep(4);
      return;
    }

    const response = await fetch("/api/aquasport/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        aquasportClassId: classId,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        level: form.level,
        health: form.health,
        message: form.comment
      })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setSubmitError(result?.error || "Impossible de rejoindre la liste d’attente.");
      return;
    }

    setSubmitError("");
    alert("Vous avez été ajouté à la liste d’attente de cette séance.");
  }

  return (
    <>
      <DemoBadge />
      <TopBar />
      <header className="header">
        <div className="container nav">
          <button className="brand" onClick={() => goTo("home")}>
            <div className="brand-mark">◆</div>
            <div>
              <div className="brand-name">Esthetic Diamonds</div>
              <div className="brand-sub">Beauté · Spa · Aqua-sports</div>
            </div>
          </button>
          <nav className="nav-links">
            <button onClick={() => goTo("home")}>Accueil</button>
            <button onClick={() => goTo("catalog")}>Nos soins</button>
            <button onClick={() => goTo("booking")}>Réservation</button>
            <a href="/cartes-cadeaux">Cartes cadeaux</a>
            <a href="/admin">Admin V1</a>
          </nav>
          <button className="btn btn-primary" onClick={() => goTo("booking")}>
            Prendre RDV
          </button>
        </div>
      </header>

      {view === "home" && (
        <>
          <section className="hero">
            <div className="container">
              <div>
                <div className="hero-kicker">Un havre de paix pour votre corps et votre esprit</div>
                <h1>Votre bien-être au cœur de nos priorités.</h1>
                <p>
                  L’expert du bien-être et de la beauté en Guadeloupe, pour une expérience
                  sensorielle fluide, chic et apaisante.
                </p>
                <div className="hero-actions">
                  <button className="btn btn-primary" onClick={() => goTo("booking")}>
                    Réserver un soin
                  </button>
                  <button
                    className="btn btn-light"
                    onClick={() => {
                      setActiveCategory("aqua-sports");
                      goTo("catalog");
                    }}
                  >
                    Réserver Aqua-sports
                  </button>
                </div>
              </div>
              <div className="hero-card">
                <span className="badge">Supabase V1</span>
                <h2>Réservation connectée à la base de données</h2>
                <p>
                  Le catalogue, les clients et les réservations peuvent maintenant provenir de
                  Supabase.
                </p>
                <div className="hero-mini-grid">
                  <div className="hero-mini">
                    <strong>2 min</strong>
                    <span>Parcours client rapide</span>
                  </div>
                  <div className="hero-mini">
                    <strong>DB</strong>
                    <span>Prestations depuis Supabase</span>
                  </div>
                  <div className="hero-mini">
                    <strong>Admin</strong>
                    <span>Réservations sécurisées</span>
                  </div>
                  <div className="hero-mini">
                    <strong>Next</strong>
                    <span>Prêt pour Vercel</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="quick-services">
            <div className="container quick-grid">
              <QuickCard icon="✦" title="Soins visage" text="Soins personnalisés, éclat, anti-âge et hydratation." />
              <QuickCard icon="≈" title="Aqua-sports" text="Aquabike, aquagym et cours aquatiques." />
              <QuickCard icon="◇" title="Massages" text="Relaxation profonde et revitalisation." />
              <a href="/cartes-cadeaux" style={{ textDecoration: "none" }}>
                <QuickCard icon="◆" title="Cartes cadeaux" text="Idées cadeaux et rituels bien-être." />
              </a>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <SectionHead
                eyebrow="Nos soins de beauté et de bien-être"
                title="Laissez-vous envelopper par une atmosphère chic et apaisante."
                description="Cette version est connectable à Supabase et conserve la charte turquoise, blanche et spa du site Esthetic Diamonds."
                action={
                  <button className="btn btn-dark" onClick={() => goTo("catalog")}>
                    Voir les prestations
                  </button>
                }
              />

              {loading && <SkeletonGrid count={4} />}
              {loadError && (
                <PremiumNotice type="error" title="Impossible de charger les prestations">
                  {loadError}
                </PremiumNotice>
              )}

              {!loading && !loadError && (
                <div className="grid grid-4">
                  {(featuredServices.length ? featuredServices : services.slice(0, 4)).map((service) => (
                    <ServiceCard key={service.id} service={service} onBook={() => startBooking(service.id)} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {view === "catalog" && (
        <section className="section">
          <div className="container">
            <SectionHead
              eyebrow="Catalogue réservation"
              title="Nos soins"
              description="Soins du visage, épilation, beauté des mains et pieds, massages, minceur, Aqua-sports et coffrets."
              action={
                <input
                  className="input"
                  style={{ maxWidth: 350 }}
                  placeholder="Rechercher une prestation"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              }
            />

            <div className="filters">
              <button
                className={`filter ${activeCategory === "all" ? "active" : ""}`}
                onClick={() => setActiveCategory("all")}
              >
                Tous
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={`filter ${activeCategory === category.slug ? "active" : ""}`}
                  onClick={() => setActiveCategory(category.slug)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {loading && <SkeletonGrid count={6} />}

            {!loading && filteredServices.length === 0 && (
              <EmptyState
                eyebrow="Recherche"
                title="Aucune prestation ne correspond à votre recherche."
                description="Essayez une autre catégorie ou retirez quelques mots-clés."
                action={
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSearch("");
                      setActiveCategory("all");
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                }
              />
            )}

            {!loading && filteredServices.length > 0 && (
              <div className="grid grid-3">
                {filteredServices.map((service) => (
                  <ServiceCard key={service.id} service={service} onBook={() => startBooking(service.id)} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {view === "booking" && (
        <section className="section">
          <div className="container">
            <div className="eyebrow">Prendre rendez-vous</div>
            <h1 className="page-title">Choisissez votre moment de bien-être.</h1>
            <p className="section-desc">
              Tunnel V1 : prestation, date, créneau, informations et confirmation.
            </p>

            <div className="booking-steps">
              {["Prestation", "Date", "Créneau", "Informations", "Confirmation"].map((label, index) => (
                <div key={label} className={`step ${step >= index + 1 ? "active" : ""}`}>
                  {index + 1}. {label}
                </div>
              ))}
            </div>

            <div className="card card-pad">
              {step === 1 && (
                <>
                  <h2 style={{ fontSize: 34 }}>Sélectionnez votre prestation</h2>
                  {services.length === 0 && (
                    <EmptyState
                      title="Aucune prestation active."
                      description="Les prestations apparaîtront ici dès qu’elles seront activées dans l’admin."
                    />
                  )}
                  {services.length > 0 && (
                    <div className="choice-grid">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        className={`choice ${form.serviceId === service.id ? "active" : ""}`}
                        onClick={() => {
                          updateField("serviceId", service.id);
                          updateField("employeeId", "");
                          updateField("time", "");
                        }}
                      >
                        <h3>{service.name}</h3>
                        <p>{service.short_description}</p>
                        <div className="service-meta">
                          <span>{service.duration_minutes} min</span>
                          <span className="price">{money(service.price_cents)}</span>
                        </div>
                      </button>
                    ))}
                    </div>
                  )}
                  <div className="actions">
                    <span />
                    <button
                      className="btn btn-primary"
                      disabled={!form.serviceId}
                      onClick={() => setStep(2)}
                    >
                      Continuer
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 style={{ fontSize: 34 }}>
                    {isAquasportBooking ? "Choisissez votre séance Aqua-sports" : "Choisissez votre date"}
                  </h2>

                  {isAquasportBooking ? (
                    <div className="grid grid-2" style={{ marginTop: 24 }}>
                      {selectedAquasportClasses.length === 0 && (
                        <EmptyState
                          title="Aucune séance disponible pour cette activité."
                          description="L’équipe pourra ajouter les prochaines séances depuis l’espace admin Aqua-sports."
                        />
                      )}

                      {selectedAquasportClasses.map((classItem) => {
                        const remaining = Math.max(classItem.capacity_max - (classItem.registered_count || 0), 0);
                        const isFull = remaining <= 0 || classItem.status === "full";
                        const isClosed = classItem.status === "closed";

                        return (
                          <button
                            key={classItem.id}
                            className={`choice ${form.aquasportClassId === classItem.id ? "active" : ""}`}
                            onClick={() => {
                              if (!isFull && !isClosed) {
                                updateField("aquasportClassId", classItem.id);
                                updateField("date", classItem.start_at.slice(0, 10));
                                updateField("time", formatTime(classItem.start_at));
                              }
                            }}
                            disabled={isClosed}
                          >
                            <h3>{classItem.title}</h3>
                            <p>
                              {formatDateTime(classItem.start_at)}
                              <br />
                              Niveau : {classItem.level}
                              <br />
                              Coach : {classItem.employees?.public_display_name || "À confirmer"}
                              <br />
                              Ressource : {classItem.resources?.name || "Espace Aqua-sports"}
                            </p>
                            <div className="service-meta">
                              <span>{remaining} place(s) restante(s)</span>
                              <span className="price">{isFull ? "Complet" : classItem.status}</span>
                            </div>
                            {isFull && (
                              <span
                                className="btn btn-light"
                                style={{ width: "100%", marginTop: 14 }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  joinWaitlist(classItem.id);
                                }}
                              >
                                Rejoindre la liste d’attente
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-2" style={{ marginTop: 24 }}>
                      <label>
                        <span>Date souhaitée</span>
                        <input
                          className="input"
                          type="date"
                          value={form.date}
                          onChange={(event) => {
                            updateField("date", event.target.value);
                            updateField("time", "");
                          }}
                        />
                      </label>
                      <div className="summary-item">
                        <small>Votre sélection</small>
                        <strong>{selectedService?.name || "Aucune prestation"}</strong>
                        {selectedService && (
                          <p className="muted" style={{ marginTop: 8 }}>
                            {selectedService.duration_minutes} min · {money(selectedService.price_cents)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="actions">
                    <button className="btn btn-light" onClick={() => setStep(1)}>
                      Retour
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={isAquasportBooking && !form.aquasportClassId}
                      onClick={() => setStep(isAquasportBooking ? 4 : 3)}
                    >
                      Continuer
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2 style={{ fontSize: 34 }}>Choisissez votre créneau</h2>
                  <div className="grid grid-2" style={{ marginTop: 24 }}>
                    <label>
                      <span>Employé</span>
                      <select
                        className="select"
                        value={form.employeeId}
                        onChange={(event) => {
                          updateField("employeeId", event.target.value);
                          updateField("time", "");
                        }}
                      >
                        <option value="">Attribution automatique</option>
                        {employeesForService.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.public_display_name} · {employee.role_title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <label>
                        <span>Créneaux disponibles</span>
                      </label>
                      {availableSlots.length === 0 ? (
                        <div className="alert">Aucun créneau disponible pour cette date.</div>
                      ) : (
                        <div className="slot-grid">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              className={`slot ${form.time === slot ? "active" : ""}`}
                              onClick={() => updateField("time", slot)}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="actions">
                    <button className="btn btn-light" onClick={() => setStep(2)}>
                      Retour
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={!form.time}
                      onClick={() => setStep(4)}
                    >
                      Continuer
                    </button>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h2 style={{ fontSize: 34 }}>Vos informations</h2>
                  <div className="form-grid" style={{ marginTop: 24 }}>
                    <label>
                      <span>Prénom</span>
                      <input
                        className="input"
                        value={form.firstName}
                        onChange={(event) => updateField("firstName", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Nom</span>
                      <input
                        className="input"
                        value={form.lastName}
                        onChange={(event) => updateField("lastName", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Téléphone</span>
                      <input
                        className="input"
                        value={form.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>E-mail</span>
                      <input
                        className="input"
                        value={form.email}
                        onChange={(event) => updateField("email", event.target.value)}
                      />
                    </label>
                  </div>

                  {isAquasportBooking && (
                    <div className="form-grid" style={{ marginTop: 16 }}>
                      <label>
                        <span>Niveau Aqua-sports</span>
                        <select
                          className="select"
                          value={form.level}
                          onChange={(event) => updateField("level", event.target.value)}
                        >
                          <option>débutant</option>
                          <option>intermédiaire</option>
                          <option>avancé</option>
                        </select>
                      </label>
                      <label>
                        <span>Information santé à signaler</span>
                        <input
                          className="input"
                          placeholder="Optionnel"
                          value={form.health}
                          onChange={(event) => updateField("health", event.target.value)}
                        />
                      </label>
                    </div>
                  )}

                  <label style={{ display: "block", marginTop: 16 }}>
                    <span>Commentaire</span>
                    <textarea
                      value={form.comment}
                      onChange={(event) => updateField("comment", event.target.value)}
                    />
                  </label>

                  <label style={{ display: "block", marginTop: 16 }}>
                    <span>Code carte cadeau</span>
                    <input
                      className="input"
                      value={form.giftCardCode}
                      onChange={(event) => updateField("giftCardCode", event.target.value.toUpperCase())}
                      placeholder="Exemple : EDS-XXXXXXXXXX"
                    />
                  </label>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Si le code est valide, son solde sera automatiquement déduit du montant de la réservation.
                  </p>

                  <label
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 20,
                      background: "var(--soft)"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={(event) => updateField("consent", event.target.checked)}
                    />
                    <span style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>
                      J’accepte les conditions de réservation et la politique de confidentialité.
                    </span>
                  </label>

                  {submitError && <div className="error">{submitError}</div>}

                  <div className="actions">
                    <button className="btn btn-light" onClick={() => setStep(3)}>
                      Retour
                    </button>
                    <button className="btn btn-primary" disabled={submitting} onClick={submitBooking}>
                      {submitting ? "Création..." : "Confirmer la réservation"}
                    </button>
                  </div>
                </>
              )}

              {step === 5 && createdBooking && (
                <>
                  <div
                    style={{
                      margin: "-24px -24px 24px",
                      padding: 34,
                      borderRadius: 30,
                      background: "linear-gradient(135deg,var(--ink),#07383A)",
                      color: "white"
                    }}
                  >
                    <span className="badge">Réservation confirmée</span>
                    <h2 style={{ fontSize: 40, marginTop: 14 }}>Votre rendez-vous est confirmé.</h2>
                    <p style={{ color: "rgba(255,255,255,.72)", marginTop: 10 }}>
                      Référence : {createdBooking.booking_reference}
                    </p>
                  </div>
                  <div className="summary-grid">
                    <Summary label="Prestation" value={createdBooking.service.name} />
                    <Summary label="Date" value={dateLabel(createdBooking.selectedDate)} />
                    <Summary label="Heure" value={createdBooking.selectedTime} />
                    <Summary label="Durée" value={`${createdBooking.service.duration_minutes} min`} />
                    <Summary label="Prix" value={money(createdBooking.service.price_cents)} />
                    {createdBooking?.gift_card_amount_cents > 0 && (
                      <Summary label="Carte cadeau" value={`-${money(createdBooking.gift_card_amount_cents)}`} />
                    )}
                    {createdBooking?.payment_due_cents > 0 && (
                      <Summary label="Reste à payer" value={money(createdBooking.payment_due_cents)} />
                    )}
                    <Summary
                      label="Employé"
                      value={createdBooking.employee?.public_display_name || "Attribution automatique"}
                    />
                  </div>
                  <div className="success-box">
                    La réservation est enregistrée dans Supabase. L’e-mail client, la notification
                    interne, Google Calendar, WhatsApp et le lien de gestion ont été traités selon la configuration.
                  </div>
                  {createdBooking?.management_token && (
                    <div className="alert">
                      Pour payer, modifier ou annuler cette réservation, utilisez le lien reçu par e-mail.
                    </div>
                  )}
                  <div className="actions">
                    <button className="btn btn-light" onClick={() => goTo("home")}>
                      Retour accueil
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setForm(initialForm);
                        setCreatedBooking(null);
                        setStep(1);
                      }}
                    >
                      Nouvelle réservation
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function TopBar() {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <span>
          <strong>ESTHETIC DIAMONDS & SPA</strong> · Hôtel Saint-Georges, Saint-Claude
        </span>
        <span>09 74 56 43 36 · Lun-Ven 09h-12h / 13h-18h</span>
      </div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {description && <p className="section-desc">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function QuickCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="quick-card">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function ServiceCard({ service, onBook }: { service: Service; onBook: () => void }) {
  return (
    <article className="card service-card">
      <div
        className="service-img"
        style={{ backgroundImage: `url(${service.image_url || FALLBACK_IMAGE})` }}
      />
      <div className="service-content">
        <div className="service-top">
          <h3>{service.name}</h3>
          <span className={`badge ${service.service_type === "collective" ? "success" : "dark"}`}>
            {service.service_type === "collective" ? "Collectif" : "Individuel"}
          </span>
        </div>
        <p>{service.short_description}</p>
        <div className="service-meta">
          <span>{service.duration_minutes} min</span>
          <span className="price">{money(service.price_cents)}</span>
        </div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={onBook}>
          Réserver
        </button>
      </div>
    </article>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

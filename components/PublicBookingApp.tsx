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

type View = "home" | "catalog" | "booking" | "account";
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

type ClientAccount = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
};

const initialAccountForm: ClientAccount = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  birthDate: ""
};

type DianaRecommendation = {
  title: string;
  intro: string;
  serviceIds: string[];
  tips: string[];
};

const DIANA_EXAMPLES = [
  "J’ai la peau terne et je veux retrouver de l’éclat",
  "Je suis fatiguée, stressée, j’ai besoin de souffler",
  "Je ne sais pas quoi offrir à ma mère",
  "Je veux une peau plus nette et moins de poils",
  "Je veux reprendre une activité douce dans l’eau",
  "J’ai des rides, un manque de fermeté ou une peau fatiguée",
  "Je ne sais pas exactement ce que je veux",
  "J’ai une demande bizarre, aide-moi à choisir"
];

const DIANA_PERSONAS = [
  "Diana Renoir vous répond avec douceur et précision.",
  "Diana Renoir analyse votre demande comme une conseillère spa.",
  "Diana Renoir vous oriente sans forcer la vente.",
  "Diana Renoir privilégie une recommandation claire et réaliste.",
  "Diana Renoir transforme votre besoin en choix simple."
];

const DIANA_BOUNDARY_RESPONSES = [
  "Je peux vous aider à choisir un soin esthétique, bien-être ou aqua-sport, mais je ne peux pas répondre à cette demande sous cette forme.",
  "Votre demande sort du cadre d’un conseil spa. Je peux en revanche vous orienter vers une prestation détente, peau, épilation, coffret ou aqua-sport.",
  "Je reste dans mon rôle de conseillère bien-être : je peux vous aider à choisir un soin adapté, mais pas traiter une demande inappropriée ou dangereuse.",
  "Cette demande n’est pas adaptée à une plateforme de réservation. Reformulez votre besoin en parlant de peau, détente, épilation, silhouette, cadeau ou aqua-sport."
];

const DIANA_FOLLOW_UPS = [
  "Si vous hésitez encore, commencez par la prestation la plus douce puis demandez conseil sur place.",
  "Si votre besoin est très précis, une prise de contact avec l’équipe reste recommandée avant de réserver.",
  "Je vous propose une orientation, mais l’équipe pourra confirmer le choix selon votre peau, votre état du moment et vos attentes.",
  "Pour un premier rendez-vous, choisissez la prestation qui répond au besoin principal plutôt que de tout traiter en une seule fois."
];

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
  const [clientAccount, setClientAccount] = useState<ClientAccount | null>(null);
  const [accountForm, setAccountForm] = useState<ClientAccount>(initialAccountForm);
  const [accountMessage, setAccountMessage] = useState("");
  const [dianaNeed, setDianaNeed] = useState("");
  const [dianaRecommendation, setDianaRecommendation] = useState<DianaRecommendation | null>(null);

  const selectedService = useMemo(
    () => services.find((service) => service.id === form.serviceId) || null,
    [services, form.serviceId]
  );

  const employeesForService = useMemo(() => {
    return employeeServices
      .filter((row) => row.service_id === form.serviceId && row.employees)
      .map((row) => row.employees as EmployeeOption);
  }, [employeeServices, form.serviceId]);

  const selectedEmployee = useMemo(() => {
    return employeesForService.find((employee) => employee.id === form.employeeId) || employeesForService[0] || null;
  }, [employeesForService, form.employeeId]);

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

  const isAquasportBooking = selectedService?.category?.slug === "bouger-en-douceur";

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

  const dianaServices = useMemo(() => {
    if (!dianaRecommendation) return [];
    return dianaRecommendation.serviceIds
      .map((serviceId) => services.find((service) => service.id === serviceId))
      .filter(Boolean) as Service[];
  }, [dianaRecommendation, services]);

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
    const saved = window.localStorage.getItem("eds_client_account");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ClientAccount;
        setClientAccount(parsed);
        setAccountForm(parsed);
        setForm((previous) => ({
          ...previous,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          phone: parsed.phone,
          email: parsed.email
        }));
      } catch {
        window.localStorage.removeItem("eds_client_account");
      }
    }
  }, []);

  function createClientAccount() {
    setAccountMessage("");

    if (!accountForm.firstName || !accountForm.lastName || !accountForm.phone || !accountForm.email) {
      setAccountMessage("Merci de renseigner le prénom, le nom, le téléphone et l’e-mail.");
      return;
    }

    window.localStorage.setItem("eds_client_account", JSON.stringify(accountForm));
    setClientAccount(accountForm);
    setForm((previous) => ({
      ...previous,
      firstName: accountForm.firstName,
      lastName: accountForm.lastName,
      phone: accountForm.phone,
      email: accountForm.email
    }));
    setAccountMessage("Compte client créé. Tes réservations seront préremplies avec tes informations.");
  }

  function disconnectClientAccount() {
    window.localStorage.removeItem("eds_client_account");
    setClientAccount(null);
    setAccountForm(initialAccountForm);
    setAccountMessage("Compte client déconnecté sur cet appareil.");
  }

  function normalizeDianaText(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s€'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pickDianaLine(lines: string[], seed: string) {
    if (!lines.length) return "";
    const normalizedSeed = normalizeDianaText(seed);
    const score = normalizedSeed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
    return lines[score % lines.length];
  }

  function hasAny(value: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(value));
  }

  function findDianaServices(keywords: string[], preferredCategorySlug?: string, limit = 3) {
    const normalizedKeywords = keywords.map(normalizeDianaText).filter(Boolean);

    return services
      .map((service) => {
        const haystack = normalizeDianaText(
          `${service.name} ${service.short_description || ""} ${service.long_description || ""} ${service.category?.name || ""}`
        );

        let score = normalizedKeywords.reduce(
          (total, keyword) => total + (haystack.includes(keyword) ? 3 : 0),
          0
        );

        if (preferredCategorySlug && service.category?.slug === preferredCategorySlug) {
          score += 3;
        }

        if (service.is_featured) {
          score += 1;
        }

        return { service, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (a.service.display_order || 0) - (b.service.display_order || 0))
      .slice(0, limit)
      .map((item) => item.service);
  }

  function buildDianaRecommendation({
    title,
    intro,
    keywords,
    category,
    tips,
    request,
    limit = 3
  }: {
    title: string;
    intro: string;
    keywords: string[];
    category?: string;
    tips: string[];
    request: string;
    limit?: number;
  }) {
    const matches = findDianaServices(keywords, category, limit);
    const opening = pickDianaLine(DIANA_PERSONAS, request);
    const followUp = pickDianaLine(DIANA_FOLLOW_UPS, request + title);

    return {
      title,
      intro: `${opening} ${intro}`,
      serviceIds: matches.map((service) => service.id),
      tips: [...tips, followUp]
    };
  }

  function askDianaRenoir() {
    const request = normalizeDianaText(dianaNeed);

    if (!request) {
      setDianaRecommendation({
        title: "Diana Renoir a besoin d’un peu plus de détails",
        intro: "Expliquez votre besoin en quelques mots. Par exemple : peau terne, stress, cadeau, épilation, aqua-sport, jambes lourdes, rides, détente ou regard.",
        serviceIds: [],
        tips: [
          "Une bonne orientation commence par un besoin clair.",
          "Vous pouvez aussi cliquer sur un exemple pour tester Diana."
        ]
      });
      return;
    }

    const dangerousOrMedical = hasAny(request, [
      /\b(mourir|suicide|me tuer|automutilation|sang|blessure grave|infection|brulure grave|allergie severe|urgence|douleur intense|malaise|medicament|ordonnance|diagnostic medical|cancer|grossesse a risque)\b/,
      /\b(maladie|infection|mycose|eczema severe|psoriasis severe|plaie ouverte|fievre|varice douloureuse)\b/
    ]);

    if (dangerousOrMedical) {
      setDianaRecommendation({
        title: "Diana Renoir ne remplace pas un avis médical",
        intro: "Votre demande semble toucher à une situation médicale, douloureuse ou urgente. Je ne vais pas vous orienter vers une prestation comme si c’était un simple besoin esthétique.",
        serviceIds: [],
        tips: [
          "Contactez un professionnel de santé si vous avez une douleur, une plaie, une infection, une réaction importante ou un doute médical.",
          "Après validation médicale, l’équipe pourra vous conseiller une prestation douce et adaptée.",
          "Pour une demande bien-être non médicale, reformulez votre besoin : détente, peau sensible, jambes lourdes, fatigue ou cadeau."
        ]
      });
      return;
    }

    const inappropriate = hasAny(request, [
      /\b(sex|sexe|sexuel|nu|nue|nudes|escort|prostitution|massage erotique|erotique|happy ending|parties intimes|attouchement|drogue|cocaine|weed|thc|alcool fort)\b/,
      /\b(insulte|nique|pute|salope|connasse|connard|fdp)\b/
    ]);

    if (inappropriate) {
      setDianaRecommendation({
        title: "Diana Renoir garde un cadre professionnel",
        intro: pickDianaLine(DIANA_BOUNDARY_RESPONSES, request),
        serviceIds: [],
        tips: [
          "Vous pouvez reformuler votre demande autour d’un besoin réel : détente, peau, épilation, coffret, silhouette ou aqua-sport.",
          "Exemple acceptable : « je cherche un massage relaxant pour relâcher les tensions du dos ».",
          "La plateforme est réservée aux prestations esthétiques, bien-être et aqua-sports."
        ]
      });
      return;
    }

    const nonsense = request.length < 4 || hasAny(request, [
      /^(azerty|qwerty|test|lol|mdr|blabla|???|xxx|123|rien|nimporte quoi)$/i,
      /\b(dinosaure|dragon|alien|sorcellerie|teleportation|devenir invisible|lune|mars|robot tueur)\b/
    ]);

    if (nonsense) {
      setDianaRecommendation({
        title: "Diana Renoir a compris que la demande est floue",
        intro: "Votre message ne correspond pas encore à un besoin de soin identifiable. Je peux quand même vous aider si vous partez d’une sensation ou d’un objectif.",
        serviceIds: findDianaServices(["diagnostic", "soin", "massage", "coffret"], undefined, 3).map((service) => service.id),
        tips: [
          "Essayez : « je veux me détendre », « ma peau est terne », « je veux offrir un cadeau », « je veux faire de l’aqua-sport ».",
          "Si vous ne savez vraiment pas quoi choisir, commencez par une prestation découverte ou un massage relaxant.",
          "Diana ne devine pas la vie de la cliente : elle transforme une demande claire en recommandation."
        ]
      });
      return;
    }

    const budgetMatch = request.match(/(\d{2,3})\s?€|budget\s?(\d{2,3})|moins de\s?(\d{2,3})/);
    const budget = budgetMatch
      ? Number(budgetMatch[1] || budgetMatch[2] || budgetMatch[3])
      : null;

    const wantsGift = hasAny(request, [/\b(cadeau|offrir|maman|mere|anniversaire|noel|saint valentin|fete des meres|coffret|carte cadeau|surprise)\b/]);
    const wantsSkin = hasAny(request, [/\b(peau|terne|eclat|lumineuse|fatiguee|hydrat|seche|sensible|ride|fermete|anti age|anti-age|tache|cicatrice|imperfection|bouton|grain|pores|visage|collagene)\b/]);
    const wantsRelax = hasAny(request, [/\b(stress|fatigue|souffler|pause|detente|relax|massage|tension|dos|nuque|corps|spa|sauna|gommage|enveloppement|lacher prise|pression)\b/]);
    const wantsConfidence = hasAny(request, [/\b(poil|epilation|laser|cire|jambe|maillot|aisselle|sourcil|cil|cils|regard|main|pied|ongle|nette|confiance|propre|feminine|semi permanent)\b/]);
    const wantsAqua = hasAny(request, [/\b(aqua|aquabike|aquagym|sport|bouger|tonifier|silhouette|articulation|eau|piscine|reprise|douceur|maitre nageur)\b/]);
    const wantsMinceur = hasAny(request, [/\b(minceur|cellulite|ventre|jambes lourdes|drainage|silhouette|maderotherapie|raffermir|tonifier)\b/]);
    const hesitant = hasAny(request, [/\b(je ne sais pas|jhesite|j hesite|quoi choisir|conseille|aide moi|perdue|pas sure|pas sur|besoin de conseil)\b/]);

    if (wantsGift) {
      const keywords = budget && budget <= 90
        ? ["coffret", "pause douceur", "evasion", "75", "90"]
        : ["coffret", "rituel", "evasion", "escapade", "prestige"];
      setDianaRecommendation(buildDianaRecommendation({
        title: "Diana Renoir recommande un coffret bien-être",
        intro: budget
          ? `Votre demande ressemble à un cadeau avec un budget autour de ${budget} €. Je privilégie donc une option claire, facile à offrir et compréhensible.`
          : "Votre demande ressemble à une intention cadeau. Je privilégie une offre simple à comprendre, désirable et adaptée à une vraie parenthèse bien-être.",
        keywords,
        category: "soffrir-une-vraie-pause",
        request,
        tips: [
          "Pour un cadeau, il faut surtout une promesse claire : détente, évasion ou rituel premium.",
          "Un coffret est plus facile à vendre quand il précise le prix, le contenu, la durée et le bénéfice.",
          "Si la personne est fatiguée ou stressée, choisissez plutôt détente. Si elle aime les expériences, choisissez plutôt rituel."
        ]
      }));
      return;
    }

    if (wantsSkin) {
      let keywords = ["soin", "visage", "eclat", "hyaluronique", "silicium", "exception marine"];
      let precision = "Je vous oriente vers un soin visage ciblé.";

      if (hasAny(request, [/\b(grasse|bouton|imperfection|pores|acne|brillance)\b/])) {
        keywords = ["purete", "microneedling", "peeling", "visage"];
        precision = "Votre demande évoque une peau grasse, des imperfections ou un besoin de peau plus nette.";
      } else if (hasAny(request, [/\b(seche|sensible|tiraille|rougeur|deshydratee)\b/])) {
        keywords = ["cold cream", "visage", "soin", "hydrat"];
        precision = "Votre demande évoque une peau sèche, sensible ou inconfortable.";
      } else if (hasAny(request, [/\b(ride|fermete|relachement|anti age|anti-age|collagene|raffermir)\b/])) {
        keywords = ["hyaluronique", "silicium", "exception marine", "anti-age"];
        precision = "Votre demande évoque la fermeté, les rides ou un objectif anti-âge.";
      } else if (hasAny(request, [/\b(tache|eclat|terne|lumineuse|bonne mine)\b/])) {
        keywords = ["coup d’eclat", "lumiere", "peeling", "visage"];
        precision = "Votre demande évoque l’éclat, les taches ou une peau fatiguée.";
      } else if (hasAny(request, [/\b(cicatrice|grain|texture)\b/])) {
        keywords = ["microneedling", "peeling", "purete"];
        precision = "Votre demande évoque la texture de peau, les cicatrices ou le grain de peau.";
      }

      setDianaRecommendation(buildDianaRecommendation({
        title: "Diana Renoir recommande un soin visage ciblé",
        intro: `${precision} L’objectif est de choisir selon le besoin réel de la peau, pas seulement selon le nom du soin.`,
        keywords,
        category: "sublimer-la-peau",
        request,
        tips: [
          "Si vous hésitez, commencez par un soin découverte ou un diagnostic peau.",
          "Pour les résultats visibles, les protocoles de plusieurs soins sont souvent plus cohérents qu’une seule séance.",
          "Diana évite les promesses médicales : l’objectif est d’orienter, pas de garantir un résultat."
        ]
      }));
      return;
    }

    if (wantsAqua) {
      setDianaRecommendation(buildDianaRecommendation({
        title: "Diana Renoir recommande une séance Aqua-sports",
        intro: "Votre demande correspond à un besoin de mouvement doux, de tonification ou de reprise progressive dans l’eau.",
        keywords: ["aquabike", "aquagym", "eveil aquatique", "seance"],
        category: "bouger-en-douceur",
        request,
        tips: [
          "L’aqua-sport est adapté quand on veut bouger avec moins d’impact sur les articulations.",
          "Pour progresser, la régularité est plus importante qu’une séance isolée.",
          "Sur la réservation aqua-sport, Ludivine sera la référence côté maître-nageur."
        ]
      }));
      return;
    }

    if (wantsMinceur) {
      setDianaRecommendation(buildDianaRecommendation({
        title: "Diana Renoir recommande une orientation silhouette",
        intro: "Votre demande parle de silhouette, jambes lourdes, drainage ou tonicité. Je vous oriente vers des soins corps cohérents avec cet objectif.",
        keywords: ["maderotherapie", "drainage", "jambes", "palper-rouler", "silhouette", "minceur"],
        category: wantsRelax ? "soffrir-une-vraie-pause" : undefined,
        request,
        tips: [
          "Pour la silhouette, il vaut mieux penser en protocole plutôt qu’en séance unique.",
          "Évitez les attentes irréalistes : les résultats dépendent de la régularité, de l’hygiène de vie et du profil.",
          "Si vous avez une douleur ou un problème circulatoire important, demandez un avis médical avant de réserver."
        ]
      }));
      return;
    }

    if (wantsConfidence) {
      const keywords = hasAny(request, [/\b(laser|durable|longtemps|poil)\b/])
        ? ["laser", "aisselles", "maillot", "jambes"]
        : hasAny(request, [/\b(cil|cils|regard|sourcil|microshading)\b/])
          ? ["microshading", "extension de cils", "sourcils"]
          : hasAny(request, [/\b(main|pied|ongle|vernis|semi)\b/])
            ? ["beaute des mains", "beaute des pieds", "semi-permanent"]
            : ["cire", "epilation", "aisselles", "maillot"];

      setDianaRecommendation(buildDianaRecommendation({
        title: "Diana Renoir recommande une prestation confiance",
        intro: "Votre demande correspond à l’univers Se sentir nette et confiante : épilation, laser, regard, mains ou pieds.",
        keywords,
        category: "se-sentir-nette-et-confiante",
        request,
        tips: [
          "Pour le laser, il faut raisonner en protocole progressif et personnalisé.",
          "Pour l’épilation cire, choisissez d’abord la zone puis le niveau de finition attendu.",
          "Pour le regard, microshading et cils répondent à deux besoins différents : sourcils structurés ou regard plus intense."
        ]
      }));
      return;
    }

    if (wantsRelax) {
      setDianaRecommendation(buildDianaRecommendation({
        title: "Diana Renoir recommande une vraie pause bien-être",
        intro: "Votre demande évoque de la fatigue, du stress, des tensions ou le besoin de ralentir. Je privilégie donc une prestation détente.",
        keywords: ["massage", "californien", "drainage", "gommage", "sauna", "modelage"],
        category: "soffrir-une-vraie-pause",
        request,
        tips: [
          "Si vous êtes très tendue, un massage ciblé dos/nuque peut être plus pertinent qu’un soin trop général.",
          "Si vous voulez une vraie expérience, choisissez plutôt un rituel avec gommage, massage ou sauna.",
          "Un massage n’est pas seulement un luxe : c’est une pause structurée."
        ]
      }));
      return;
    }

    if (hesitant) {
      setDianaRecommendation(buildDianaRecommendation({
        title: "Diana Renoir propose une première orientation",
        intro: "Vous hésitez, donc je vous propose des portes d’entrée simples plutôt qu’une liste trop longue.",
        keywords: ["coup d’eclat", "massage californien", "coffret", "diagnostic"],
        request,
        tips: [
          "Si vous voulez améliorer la peau : commencez par un soin visage.",
          "Si vous voulez souffler : commencez par un massage.",
          "Si c’est pour offrir : commencez par un coffret clair et facile à comprendre."
        ]
      }));
      return;
    }

    setDianaRecommendation(buildDianaRecommendation({
      title: "Diana Renoir propose une orientation prudente",
      intro: "Votre demande n’entre pas parfaitement dans une catégorie, donc je vous propose des options polyvalentes plutôt qu’une réponse forcée.",
      keywords: ["soin", "massage", "coffret", "diagnostic"],
      request,
      tips: [
        "Reformulez avec un objectif principal pour obtenir une recommandation plus précise.",
        "Exemples : éclat de la peau, détente, cadeau, épilation durable, jambes légères ou reprise aqua-sport.",
        "Diana ne propose pas de soin inadapté quand la demande est trop vague."
      ]
    }));
  }


  function startBooking(serviceId: string) {
    setForm({
      ...initialForm,
      serviceId,
      aquasportClassId: "",
      firstName: clientAccount?.firstName || "",
      lastName: clientAccount?.lastName || "",
      phone: clientAccount?.phone || "",
      email: clientAccount?.email || ""
    });
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
        employee: selectedEmployee,
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
            <div className="brand-mark">
              <img src="/brand/logo-esthetic-diamonds-black-blue.png" alt="Esthetic Diamonds & Spa" />
            </div>
            <div>
              <div className="brand-name">Esthetic Diamonds</div>
              <div className="brand-sub">Beauté · Spa · Aqua-sports</div>
            </div>
          </button>
          <nav className="nav-links">
            <button onClick={() => goTo("home")}>Accueil</button>
            <button onClick={() => goTo("catalog")}>Nos soins</button>
            <button onClick={() => goTo("booking")}>Réservation</button>
            <button onClick={() => goTo("account")}>Mon compte</button>
            <a href="/cartes-cadeaux">Cartes cadeaux</a>
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
                <h1>Spa beauté & bien-être premium à Saint-Claude.</h1>
                <p>
                  Soins visage, massages, épilation, coffrets cadeaux et aqua-sports dans un espace dédié à votre bien-être.
                </p>
                <div className="hero-actions">
                  <button className="btn btn-primary" onClick={() => goTo("booking")}>
                    Réserver un soin
                  </button>
                  <button
                    className="btn btn-light"
                    onClick={() => {
                      setActiveCategory("soffrir-une-vraie-pause");
                      goTo("catalog");
                    }}
                  >
                    Découvrir les coffrets
                  </button>
                  <button
                    className="btn btn-light"
                    onClick={() => {
                      setActiveCategory("bouger-en-douceur");
                      goTo("catalog");
                    }}
                  >
                    Réserver Aqua-sports
                  </button>
                </div>
              </div>
              <div className="hero-card">
                <span className="badge">Offre clarifiée</span>
                <h2>4 univers pour choisir plus vite</h2>
                <p>
                  La réservation est structurée selon la stratégie marketing : peau, pause, confiance et aqua-sports.
                </p>
                <div className="hero-mini-grid">
                  <div className="hero-mini">
                    <strong>Peau</strong>
                    <span>Éclat, anti-âge, hydratation</span>
                  </div>
                  <div className="hero-mini">
                    <strong>Pause</strong>
                    <span>Massages, rituels, coffrets</span>
                  </div>
                  <div className="hero-mini">
                    <strong>Confiance</strong>
                    <span>Épilation, laser, cils, mains</span>
                  </div>
                  <div className="hero-mini">
                    <strong>Aqua</strong>
                    <span>Bouger en douceur</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="quick-services">
            <div className="container quick-grid">
              <button className="quick-card quick-button" onClick={() => { setActiveCategory("sublimer-la-peau"); goTo("catalog"); }}>
                <div className="icon">✦</div>
                <h3>Sublimer la peau</h3>
                <p>Peau nette, lumineuse, ferme et fraîche.</p>
              </button>
              <button className="quick-card quick-button" onClick={() => { setActiveCategory("soffrir-une-vraie-pause"); goTo("catalog"); }}>
                <div className="icon">◇</div>
                <h3>S’offrir une vraie pause</h3>
                <p>Massages, gommages, rituels et coffrets.</p>
              </button>
              <button className="quick-card quick-button" onClick={() => { setActiveCategory("se-sentir-nette-et-confiante"); goTo("catalog"); }}>
                <div className="icon">◆</div>
                <h3>Se sentir nette et confiante</h3>
                <p>Épilation, laser, regard, mains et pieds.</p>
              </button>
              <button className="quick-card quick-button" onClick={() => { setActiveCategory("bouger-en-douceur"); goTo("catalog"); }}>
                <div className="icon">≈</div>
                <h3>Bouger en douceur</h3>
                <p>Aquabike, aquagym et éveil aquatique.</p>
              </button>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <SectionHead
                eyebrow="Sélection stratégique"
                title="Les prestations à pousser en priorité."
                description="Ces soins servent de portes d’entrée commerciales : diagnostic peau, massage, coffret, laser et aqua-sports."
                action={
                  <button className="btn btn-dark" onClick={() => goTo("catalog")}>
                    Voir tous les univers
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

          <section className="section soft-section">
            <div className="container">
              <SectionHead
                eyebrow="Diana Renoir · Conseillère IA"
                title="Quel soin choisir ?"
                description="Décrivez votre besoin, votre problème ou votre envie. Diana Renoir analyse la carte de soins, comprend les demandes floues, refuse les demandes inappropriées et propose une orientation adaptée."
              />

              <div className="grid grid-2 diana-grid">
                <div className="card card-pad diana-card">
                  <div className="diana-avatar">DR</div>
                  <h3>Diana Renoir</h3>
                  <p className="muted">
                    Conseillère IA paramétrée avec la carte de soins. Elle sait orienter, refuser les demandes inadaptées,
                    clarifier les demandes floues et proposer une réponse différente selon le besoin.
                  </p>

                  <label style={{ marginTop: 18, display: "block" }}>
                    <span>Expliquez votre besoin</span>
                    <textarea
                      className="input"
                      rows={5}
                      placeholder="Exemple : j’ai la peau terne, je veux retrouver de l’éclat avant un événement."
                      value={dianaNeed}
                      onChange={(event) => setDianaNeed(event.target.value)}
                      style={{ resize: "vertical", minHeight: 130 }}
                    />
                  </label>

                  <div className="diana-chips">
                    {DIANA_EXAMPLES.map((example) => (
                      <button
                        key={example}
                        className="chip"
                        onClick={() => {
                          setDianaNeed(example);
                          setDianaRecommendation(null);
                        }}
                      >
                        {example}
                      </button>
                    ))}
                  </div>

                  <div className="actions">
                    <button className="btn btn-primary" onClick={askDianaRenoir}>
                      Demander à Diana Renoir
                    </button>
                    <button
                      className="btn btn-light"
                      onClick={() => {
                        setDianaNeed("");
                        setDianaRecommendation(null);
                      }}
                    >
                      Réinitialiser
                    </button>
                  </div>
                </div>

                <div className="card card-pad">
                  <span className="badge">Orientation personnalisée</span>
                  <h3 style={{ marginTop: 12 }}>
                    {dianaRecommendation ? dianaRecommendation.title : "Diana attend votre demande"}
                  </h3>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {dianaRecommendation
                      ? dianaRecommendation.intro
                      : "Écrivez ce que vous voulez améliorer : peau, détente, pilosité, confiance, silhouette, cadeau ou reprise d’activité."}
                  </p>

                  {dianaRecommendation && dianaRecommendation.tips.length > 0 && (
                    <div className="success-box" style={{ marginTop: 16 }}>
                      {dianaRecommendation.tips.map((tip) => (
                        <p key={tip} style={{ margin: "6px 0" }}>• {tip}</p>
                      ))}
                    </div>
                  )}

                  {dianaServices.length > 0 && (
                    <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                      {dianaServices.map((service) => (
                        <div key={service.id} className="recommendation-row">
                          <div>
                            <strong>{service.name}</strong>
                            <p className="muted">
                              {service.duration_minutes} min · {(service.price_cents / 100).toLocaleString("fr-FR")} €
                            </p>
                          </div>
                          <button className="btn btn-dark" onClick={() => startBooking(service.id)}>
                            Réserver
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {view === "catalog" && (
        <section className="section">
          <div className="container">
            <SectionHead
              eyebrow="Catalogue réservation"
              title="Choisissez votre univers."
              description="Les offres sont regroupées en 4 univers marketing pour rendre le choix plus simple, plus clair et plus vendeur."
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


      {view === "account" && (
        <section className="section">
          <div className="container">
            <SectionHead
              eyebrow="Espace client"
              title="Créez votre compte client."
              description="En mode démo, le compte est conservé sur cet appareil. En production, il sera relié à Supabase Auth pour retrouver l’historique, les réservations et les cartes cadeaux."
              action={
                clientAccount ? (
                  <button className="btn btn-light" onClick={disconnectClientAccount}>
                    Se déconnecter
                  </button>
                ) : undefined
              }
            />

            <div className="grid grid-2">
              <div className="card card-pad">
                <h2 style={{ fontSize: 32 }}>
                  {clientAccount ? "Compte connecté" : "Créer mon compte"}
                </h2>
                <p className="muted" style={{ marginTop: 8 }}>
                  Ces informations préremplissent automatiquement le tunnel de réservation.
                </p>

                <div className="form-grid" style={{ marginTop: 24 }}>
                  <label>
                    <span>Prénom</span>
                    <input
                      className="input"
                      value={accountForm.firstName}
                      onChange={(event) => setAccountForm((previous) => ({ ...previous, firstName: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Nom</span>
                    <input
                      className="input"
                      value={accountForm.lastName}
                      onChange={(event) => setAccountForm((previous) => ({ ...previous, lastName: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Téléphone</span>
                    <input
                      className="input"
                      value={accountForm.phone}
                      onChange={(event) => setAccountForm((previous) => ({ ...previous, phone: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>E-mail</span>
                    <input
                      className="input"
                      value={accountForm.email}
                      onChange={(event) => setAccountForm((previous) => ({ ...previous, email: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Date de naissance, optionnel</span>
                    <input
                      className="input"
                      type="date"
                      value={accountForm.birthDate}
                      onChange={(event) => setAccountForm((previous) => ({ ...previous, birthDate: event.target.value }))}
                    />
                  </label>
                </div>

                {accountMessage && <div className="alert" style={{ marginTop: 16 }}>{accountMessage}</div>}

                <div className="actions">
                  <button className="btn btn-primary" onClick={createClientAccount}>
                    {clientAccount ? "Mettre à jour mon compte" : "Créer mon compte"}
                  </button>
                  <button className="btn btn-light" onClick={() => goTo("booking")}>
                    Réserver avec mon compte
                  </button>
                </div>
              </div>

              <div className="card card-pad">
                <h2 style={{ fontSize: 32 }}>Mon espace</h2>
                <div className="summary-grid" style={{ marginTop: 18 }}>
                  <Summary label="Statut" value={clientAccount ? "Compte client démo actif" : "Aucun compte connecté"} />
                  <Summary label="E-mail" value={clientAccount?.email || "Non renseigné"} />
                  <Summary label="Téléphone" value={clientAccount?.phone || "Non renseigné"} />
                  <Summary label="Dernière réservation" value={createdBooking?.booking_reference || "Aucune réservation créée"} />
                </div>
                <div className="success-box" style={{ marginTop: 18 }}>
                  Fonction production prévue : connexion client sécurisée, historique des rendez-vous,
                  modification / annulation, cartes cadeaux, consentement RGPD et rappels.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {view === "booking" && (
        <section className="section">
          <div className="container">
            <div className="eyebrow">Prendre rendez-vous</div>
            <h1 className="page-title">Choisissez votre moment de bien-être.</h1>
            <p className="section-desc">
              Réservez en moins de deux minutes. Choisissez votre praticienne pour l’esthétique ou Ludivine pour l’aqua-sport.
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
                      <span>{isAquasportBooking ? "Maître-nageur" : "Esthéticienne"}</span>
                      <select
                        className="select"
                        value={form.employeeId}
                        onChange={(event) => {
                          updateField("employeeId", event.target.value);
                          updateField("time", "");
                        }}
                      >
                        <option value="">Sans préférence</option>
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
                  {clientAccount ? (
                    <div className="success-box" style={{ marginTop: 16 }}>
                      Réservation liée au compte : {clientAccount.firstName} {clientAccount.lastName}.
                    </div>
                  ) : (
                    <div className="alert" style={{ marginTop: 16 }}>
                      Vous pouvez réserver sans compte, ou créer un compte pour retrouver vos informations plus rapidement.
                    </div>
                  )}
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
                    Réservation créée en mode démo. En production, elle sera enregistrée dans Supabase,
                    reliée au compte client et synchronisée avec les notifications configurées.
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

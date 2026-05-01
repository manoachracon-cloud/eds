import { NextResponse } from "next/server";
import { demoServices } from "@/lib/demoData";

export const runtime = "nodejs";

type DianaRecommendation = {
  title: string;
  intro: string;
  serviceIds: string[];
  tips: string[];
};

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const output = Array.isArray(data?.output) ? data.output : [];

  return output
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((content: any) => content?.text || "")
    .filter(Boolean)
    .join("\n");
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function cleanRecommendation(raw: any): DianaRecommendation {
  const allowedServiceIds = new Set(demoServices.map((service) => service.id));

  const serviceIds = Array.isArray(raw?.serviceIds)
    ? raw.serviceIds
        .filter((id: unknown) => typeof id === "string" && allowedServiceIds.has(id))
        .slice(0, 4)
    : [];

  return {
    title:
      typeof raw?.title === "string" && raw.title.trim()
        ? raw.title.trim().slice(0, 120)
        : "Diana Renoir propose une orientation personnalisée",
    intro:
      typeof raw?.intro === "string" && raw.intro.trim()
        ? raw.intro.trim().slice(0, 900)
        : "Diana Renoir analyse votre besoin et vous oriente vers les prestations les plus cohérentes.",
    serviceIds,
    tips:
      Array.isArray(raw?.tips)
        ? raw.tips
            .filter((tip: unknown) => typeof tip === "string" && tip.trim())
            .slice(0, 4)
            .map((tip: string) => tip.trim().slice(0, 220))
        : [
            "Cette recommandation est une orientation, pas un diagnostic médical.",
            "L’équipe pourra confirmer le soin le plus adapté lors de la prise en charge."
          ]
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY manquante. Diana repasse en mode local côté navigateur."
      },
      { status: 503 }
    );
  }

  let body: any = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      {
        recommendation: {
          title: "Diana Renoir a besoin d’un peu plus de détails",
          intro: "Décrivez votre besoin en quelques mots : peau, détente, épilation, cadeau, aqua-sport, silhouette, rides ou fatigue.",
          serviceIds: [],
          tips: [
            "Plus votre demande est précise, plus la recommandation sera utile.",
            "Exemple : « j’ai la peau terne et je veux retrouver de l’éclat »."
          ]
        }
      },
      { status: 200 }
    );
  }

  const serviceCatalog = demoServices.map((service) => ({
    id: service.id,
    name: service.name,
    category: service.category?.name || "",
    categorySlug: service.category?.slug || "",
    price_euros: service.price_cents / 100,
    duration_minutes: service.duration_minutes,
    type: service.service_type,
    description: service.short_description || service.long_description || ""
  }));

  const systemPrompt = `
Tu es Diana Renoir, conseillère IA de la plateforme de réservation Esthetic Diamonds & Spa.

Mission :
- Comprendre la demande cliente.
- Orienter vers les prestations disponibles dans le catalogue fourni.
- Répondre avec intelligence, nuance, clarté et professionnalisme.
- Ne jamais inventer une prestation qui n’existe pas dans le catalogue.
- Proposer au maximum 4 services, uniquement avec leurs ids exacts.
- Adapter la réponse à chaque formulation client, y compris les demandes floues, bizarres ou hésitantes.
- Refuser calmement les demandes sexuelles, violentes, dangereuses, illégales, insultantes ou hors cadre.
- Ne jamais faire de diagnostic médical.
- En cas de douleur forte, plaie, infection, réaction allergique, urgence ou sujet médical : recommander de consulter un professionnel de santé avant toute réservation.
- Pour les demandes normales, expliquer le raisonnement simplement et proposer des soins adaptés.

Univers commerciaux :
1. Sublimer la peau : soins visage, éclat, rides, fermeté, imperfections, microneedling.
2. S’offrir une vraie pause : massages, gommages, sauna, rituels, coffrets.
3. Se sentir nette et confiante : épilation cire, laser, cils, microshading, mains, pieds.
4. Bouger en douceur : aqua-sports, aquabike, aquagym, éveil aquatique.

Format obligatoire :
Réponds uniquement en JSON valide, sans Markdown, avec cette structure :
{
  "title": "titre court",
  "intro": "réponse personnalisée de Diana",
  "serviceIds": ["id-service-1", "id-service-2"],
  "tips": ["conseil 1", "conseil 2", "conseil 3"]
}
`;

  const userPrompt = JSON.stringify(
    {
      demandeCliente: message,
      compteClient: body?.clientAccount || null,
      catalogue: serviceCatalog
    },
    null,
    2
  );

  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt
            }
          ]
        }
      ],
      max_output_tokens: 900
    })
  });

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text();

    return NextResponse.json(
      {
        error: "Erreur OpenAI",
        details: errorText.slice(0, 500)
      },
      { status: 502 }
    );
  }

  const data = await openAiResponse.json();
  const outputText = extractOutputText(data);
  const parsed = safeJsonParse(outputText);

  if (!parsed) {
    return NextResponse.json(
      {
        error: "Réponse OpenAI non exploitable.",
        raw: outputText.slice(0, 500)
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    recommendation: cleanRecommendation(parsed),
    model
  });
}

---
name: personal-advisor
description: Personalize shopping and lifestyle product advice from a user's goal, confirmed preferences, feedback, and the real catalog. Use for personal shopping, styling, skincare, haircare, image management, or cosmetic ingredient questions.
---

# Personal Advisor

Use this skill for personal shopping and lifestyle advice in Omnilink. Keep skincare, haircare, personal color, clothing preferences, fit, and hairstyle as separate dimensions. Do not collapse them into one personality or appearance label.

## Consultation flow

1. Identify the immediate goal and domain from the current request. Reuse confirmed profile facts and memories before asking anything. Treat saved products as weak interest signals, and an explicit “not suitable” mark as feedback about that item only. The user's current correction takes priority.
2. Give the first useful answer or catalog shortlist as soon as the goal and available evidence allow it. For each suggested item, connect one actual catalog fact to the user's goal or confirmed preference, then name the most important unverified condition. Compare practical constraints and tradeoffs when they affect the choice.
3. Ask at most one focused question only when its answer would materially change the next recommendation. A provisional recommendation can precede the question. Let the user skip sensitive or uncertain details; do not start a fixed questionnaire for a narrow request.
4. After feedback, update the next shortlist immediately. Record a lasting preference only when the user explicitly states it or confirms a tentative inference; a save, click, or single rejection is not a lasting preference.
5. For skincare, prioritize the user's own reports about cleansing feel, oiliness, dryness, irritation, current products, and known exclusions. For haircare, ask about scalp condition, hair texture, treatments, routine, and goal. For styling, ask about occasion, colors and outfits they like, fit preferences, budget, and practical constraints.
6. Treat observations from photos as tentative and ask the user to confirm them. Do not infer skin sensitivity, symptoms, body measurements, or purchase constraints from an image.
7. Distinguish user-provided facts from photo observations and inferences. Use actual project catalog data for product recommendations. Do not invent products, ingredients, prices, availability, or source dates. If the catalog lacks a needed product or formula, say what information is missing.

## Ingredient reference in this project

The project includes `lib/consumer-advisor/ingredient-index.json`, generated from the user-provided BEAUTEE Cosmetic Ingredients Dataset (Lite) and Open Beauty Facts CosIng reference files. The lookup endpoint is `POST /api/consumer/ingredients` with JSON `{ "query": "<INCI name or CAS number>" }`.

Use the lookup for exact ingredient names or CAS identifiers when evaluating a supplied ingredient list. The index provides identifiers and some historical function and Annex matches. It does not provide complete product formulas, personal suitability, safety scores, current regulatory status, or product recommendations. Never present a historical Annex match or ingredient function as a current legal or safety conclusion. Preserve source attribution when summarizing these lookup results.

If the endpoint is unavailable in the current environment, inspect the local index or route implementation before proposing another lookup method. Do not make external network calls unless the user asks for current source verification or product research.

## Evidence and boundaries

- This is consumer guidance, not medical diagnosis. Avoid definitive claims that a product or ingredient is safe or suitable for an individual.
- A photo can suggest visible features to verify; it cannot establish skin type, irritation triggers, hair or scalp symptoms, or exact color season.
- For persistent rash, severe irritation, suspected allergy, or other medical symptoms, stop product-selection advice and recommend appropriate professional evaluation.
- Do not use protected commercial questionnaire text or claim that this project's questions reproduce a validated scale. The project's questionnaire research is a guide for original, adaptive questions, not a validated diagnostic instrument.
- Keep personal information minimal. Ask for measurements or sensitive details only when necessary and make them optional.

## Source notes

Project research and source limits are documented in `docs/research/personal-advisor-questionnaire-survey.md` and `lib/consumer-advisor/README.md`. Consult those files when implementing or changing the advisor flow.

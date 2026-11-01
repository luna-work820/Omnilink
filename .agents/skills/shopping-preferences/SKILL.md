---
name: shopping-preferences
description: Measure broad shopping preferences through a resumable, deterministic multiple-choice flow and map the result to the user's profile.
---

# Shopping Preferences

Use this skill to learn a person's general shopping preferences without reducing them to a single style or personality label.

## Intake and profile

- The signup flow installs this skill automatically. Do not ask the user to install it.
- Use the question bank in `lib/consumer-advisor/shopping-preference-survey/questions.json` and the deterministic rules in `weights.json`. Do not use an LLM to score answers.
- Save each answer and ladder step to the signed-in user's `eva_profile.shoppingPreferenceSurvey`. Resume at the next unanswered question. Skipped and inapplicable answers remain unknown.
- Map measurements to `eva_profile.shoppingPreferenceProfile.preferences`: price anchor and acceptable bands, value-order weights, quality/design premium weights, style intensity, and category context.
- Ask one question at a time. Support single choice, numeric, pairwise, ladder, and multi-choice inputs. Let the user skip or pause and continue later.
- Do not ask for sensitive personal details. Do not infer budget, taste, or product needs from age, gender, photos, clicks, or a single purchase.
- Do not ask for sensitive personal details. Do not infer budget, taste, or product needs from age, gender, photos, clicks, or a single purchase.

## Recommendations

- Use completed and partial profile values as broad, revisable signals across categories. The current request and explicit corrections take priority.
- Explain recommendations using product facts and the preference they match. Call out meaningful tradeoffs.
- Ask one focused follow-up only when missing information would materially change the recommendation. Make it easy to answer or skip.
- Do not treat a save, click, or one rejection as a lasting preference. Confirm before recording a new long-term preference from conversation.

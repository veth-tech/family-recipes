export const AI_GUIDE = `# Family Recipes — API guide for AI assistants

This is a small, private recipe library (two users, vegan household).
Everything below works with plain HTTP + JSON. This site is invite-only:
you cannot register; the owner gives you existing credentials to sign in with.

## 1. Authenticate

    POST /api/auth/sign-in/email
    Content-Type: application/json

    {"email": "<your email>", "password": "<your password>"}

The response sets a session cookie. Keep it (cookie jar) and send it with
every subsequent request. Check who you are with GET /api/me.

## 2. Reading

    GET  /api/recipes            → {"recipes": [...]}  (whole library, fits in memory)
    GET  /api/recipes/{id}       → full recipe incl. notes + photos
    GET  /api/recipes/tags       → {"tags": [...]}
    GET  /api/search?q=lentils   → fuzzy full-text (typos welcome)

## 3. Writing (all require the session cookie)

    POST   /api/recipes            create — JSON body:
    {
      "title": "Crispy Tofu Peanut Noodles",        // required
      "description": "One line about why it slaps", // optional
      "sourceUrl": "https://…",                     // optional
      "sourceBook": "Veganomicon p. 112",           // optional
      "servings": 4, "prepMinutes": 15, "cookMinutes": 20,  // optional ints
      "ingredients": "400 g firm tofu\\n3 tbsp soy sauce",   // freeform text,
                                    // ONE INGREDIENT PER LINE, verbatim
      "instructions": "1. Press the tofu…\\n\\n## Sauce\\n- Whisk…", // markdown ok
      "tags": ["quick weeknight", "noodles"]        // lowercase strings
    }
    PATCH  /api/recipes/{id}         partial update (same fields, all optional)
    DELETE /api/recipes/{id}         delete (cascades notes + photos)
    POST   /api/recipes/{id}/notes   {"body": "Doubled the garlic"} — append-only,
                                     never edit or delete notes
    POST   /api/import/url           {"url": "https://…"} — parses the page's
                                     schema.org Recipe data into a DRAFT.
                                     It is NOT saved. Review the draft, then
                                     create via POST /api/recipes. Some sites
                                     block bots (403) — fall back to asking
                                     the user for the details. Pages without
                                     schema.org data are fed to an AI model,
                                     which reads the recipe from the page text.
    POST   /api/import/fix          {"recipe": {...}, "prompt": "remove the
                                     prices from the ingredients"} — applies a
                                     free-text edit to an in-progress recipe
                                     and returns the full updated one as a
                                     DRAFT. Nothing is written to the library;
                                     the client reviews it first.
    POST   /api/import/text         {"text": "…"} — raw recipe text the user
                                     copied off a page (select-all + paste).
                                     The AI model reads it and returns the
                                     same DRAFT shape. Works for sites that
                                     block automated fetching.
    POST   /api/import/photo         multipart/form-data, field "file" — a photo
                                     of a recipe (cookbook page, card,
                                     screenshot). A vision model reads it and
                                     returns the same DRAFT shape. Review the
                                     draft, then create via POST /api/recipes.

## 4. Photos

    POST /api/recipes/{id}/photos            multipart/form-data, field "files"
    POST /api/recipes/{id}/photos/from-url   {"url": "<image url>"} (server downloads)
    DELETE /api/photos/{photoId}
    GET  /api/photos/{photoId}               public image bytes

## 5. Conventions

- Ingredients are freeform text, one per line — preserve the author's wording.
- Instructions are markdown; numbered steps render as a list.
- Notes are append-only history. Photos live in /data (persisted volume).
- Full machine-readable spec: GET /doc (OpenAPI 3.0). Browsable UI: /docs.
- Be polite: this is a family site. Don't bulk-delete anything.
`;

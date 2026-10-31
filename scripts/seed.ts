import { eq } from "drizzle-orm";
import { auth } from "../server/auth";
import { db } from "../server/db/client";
import { user } from "../server/db/schema";
import * as recipesService from "../server/services/recipes";

const SEED_EMAIL = "seed@family.recipes";

async function ensureSeedUser(): Promise<string> {
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, SEED_EMAIL));
  if (existing) return existing.id;
  await auth.api.signUpEmail({
    body: {
      name: "Seed",
      email: SEED_EMAIL,
      password: "seed-user-no-login-8f2",
    },
  });
  const [created] = await db
    .select()
    .from(user)
    .where(eq(user.email, SEED_EMAIL));
  return created.id;
}

const sampleRecipes: recipesService.RecipeInput[] = [
  {
    title: "Crispy Tofu Peanut Noodles",
    description: "Weeknight hero — chewy tofu, slick noodles, punchy sauce.",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 20,
    ingredients: `400 g firm tofu, pressed and cubed
2 tbsp cornstarch
300 g rice noodles
3 garlic cloves, minced
3 tbsp soy sauce
2 tbsp peanut butter
1 tbsp rice vinegar
1 tbsp maple syrup
1 tsp chili flakes
2 spring onions, sliced
handful roasted peanuts, crushed`,
    instructions: `1. Toss tofu cubes in cornstarch and pan-fry in a little oil until golden and crispy on all sides, ~10 min.

2. Cook the rice noodles according to the package, then drain.

## Sauce

- Whisk soy sauce, peanut butter, vinegar, maple syrup, chili flakes, and a splash of hot noodle water until smooth.

3. Toss noodles and tofu through the sauce over low heat until glossy.

4. Top with spring onions and crushed peanuts.`,
    tags: ["quick weeknight", "noodles", "tofu", "30 minutes"],
  },
  {
    title: "Smoky Lentil Chili",
    description: "Deep, smoky, Freezer-friendly. Doubles beautifully.",
    servings: 6,
    prepMinutes: 10,
    cookMinutes: 45,
    ingredients: `2 tbsp olive oil
1 large onion, diced
1 red bell pepper, diced
4 garlic cloves, minced
2 tsp smoked paprika
2 tsp cumin
1 tbsp cocoa powder
2 x 400 g tins black beans, drained
1 x 400 g tin brown lentils, drained
1 x 400 g tin chopped tomatoes
500 ml vegetable stock
2 tbsp soy sauce
juice of 1 lime`,
    instructions: `1. Soften the onion and bell pepper in the oil, ~8 min. Add garlic and spices and cook for 1 min more.

2. Add everything else except the lime. Simmer uncovered for 30–40 min, stirring now and then, until thick and rich.

3. Finish with lime juice and salt to taste.

**Serving:** rice, avocado, coriander, and a big spoon of coconut yogurt.`,
    tags: ["comfort food", "freezer-friendly", "lentils", "one pot"],
  },
  {
    title: "Lemon Garlic Chickpea Pasta",
    description: "15 minutes, one pan plus the pasta pot. Bright and creamy.",
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    ingredients: `200 g pasta (orecchiette or shells)
1 x 400 g tin chickpeas, drained
3 garlic cloves, sliced
zest and juice of 1 lemon
2 tbsp olive oil
1 tsp chili flakes
50 g vegan parmesan, finely grated
big handful parsley, chopped`,
    instructions: `1. Boil the pasta in well-salted water. Reserve a cup of pasta water before draining.

2. Meanwhile, fry the chickpeas in olive oil over medium-high heat until they pop and crisp, ~6 min. Add garlic and chili for the last minute.

3. Add the pasta, lemon zest and juice, and a good splash of pasta water. Toss hard.

4. Off the heat, stir through the parmesan and parsley until creamy.`,
    tags: ["quick weeknight", "pasta", "15 minutes", "chickpeas"],
  },
];

const userId = await ensureSeedUser();
const existing = await recipesService.listRecipes();
if (existing.length > 0) {
  console.log(`[seed] ${existing.length} recipes already exist — skipping`);
} else {
  for (const recipe of sampleRecipes) {
    await recipesService.createRecipe(recipe, userId);
  }
  console.log(`[seed] inserted ${sampleRecipes.length} sample recipes`);
}
process.exit(0);

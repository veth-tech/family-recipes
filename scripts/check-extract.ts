// One-off check: extractRecipeFromPhoto against a fake OpenAI-compatible
// server (stand-in for greenPT). Run: node --env-file=.env --import tsx scripts/check-extract.ts
import http from "node:http";

// Must be set BEFORE the (hoisted) import below — env.ts snapshots at load.
process.env.GREENPT_API_KEY = "test-key";
process.env.GREENPT_BASE_URL = "http://localhost:8787/v1";
process.env.GREENPT_MODEL = "test-vision";

const { extractRecipeFromPhoto } = await import("../server/services/extract");

const REPLY = {
  title: "Lentil Soup",
  description: "Weeknight staple",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 30,
  ingredients: "200 g red lentils\n1 onion",
  instructions: "1. Sauté onion.\n2. Add lentils and simmer.",
  tags: ["Soup", "vegan"],
};

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const payload = JSON.parse(body);
    const assert = (ok: boolean, msg: string) => {
      if (!ok) {
        console.error(`FAIL: ${msg}`);
        process.exit(1);
      }
    };
    assert(req.url === "/v1/chat/completions", "posts to /chat/completions");
    assert(payload.model === "test-vision", "uses configured model");
    const content = payload.messages.at(-1).content;
    const image = content.find((b: any) => b.type === "image_url");
    assert(image.image_url.url.startsWith("data:image/png;base64,"), "image sent as data URL");

    res.writeHead(200, { "Content-Type": "text/event-stream" });
    for (const piece of [ "```json\n", JSON.stringify(REPLY), "\n```" ]) {
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`,
      );
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });
});

server.listen(8787, async () => {
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050201a3f3b4080000000049454e44ae426082",
    "hex",
  );
  const draft = await extractRecipeFromPhoto(png, "image/png");
  const assert = (ok: boolean, msg: string) => {
    if (!ok) {
      console.error(`FAIL: ${msg}`, draft);
      process.exit(1);
    }
  };
  assert(draft.title === "Lentil Soup", "title extracted");
  assert(draft.servings === 4, "servings extracted");
  assert(draft.ingredients === "200 g red lentils\n1 onion", "ingredients extracted");
  assert(draft.tags.join(",") === "soup,vegan", "tags lowercased");
  assert(draft.sourceUrl === null && draft.imageUrl === null, "source/image null");
  console.log("✓ extractRecipeFromPhoto works end-to-end (fake greenPT)");
  server.close();
  process.exit(0);
});
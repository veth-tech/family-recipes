import { createUserDirect } from "../server/services/users";

const [email, name, password] = process.argv.slice(2);

if (!email || !name || !password || password.length < 8) {
  console.error(
    "usage: npm run create-user -- <email> <name> <password (8+ chars)>",
  );
  process.exit(1);
}

const result = await createUserDirect(email, name, password);
if ("error" in result) {
  console.error(`✗ ${result.error}`);
  process.exit(1);
}
console.log(`✓ created user ${email} — they can sign in now`);
process.exit(0);

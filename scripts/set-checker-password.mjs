import { createClient } from "@supabase/supabase-js";

const TEST_USER_ID = process.env.VENTIQ_TEST_USER_ID;
const TEST_USER_EMAIL = process.env.VENTIQ_TEST_USER_EMAIL;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temporaryPassword = process.env.VENTIQ_TEST_PASSWORD;

if (!TEST_USER_ID) {
  console.error("Missing VENTIQ_TEST_USER_ID in .env.local.");
  process.exit(1);
}
if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local.");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

if (!temporaryPassword || temporaryPassword.length < 12) {
  console.error(
    "Temporary password must contain at least 12 characters."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const { data, error } =
  await supabase.auth.admin.updateUserById(TEST_USER_ID, {
    password: temporaryPassword,
    email_confirm: true,
  });

if (error) {
  console.error(`Unable to set password: ${error.message}`);
  process.exit(1);
}

console.log("Checker password updated successfully.");
console.log(`Email: ${data.user?.email || TEST_USER_EMAIL}`);
console.log(`User ID: ${data.user?.id || TEST_USER_ID}`);
console.log("The temporary password was not printed.");

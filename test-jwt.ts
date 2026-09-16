import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient("https://example.com", "eyJh... (mock key)", {
  global: { headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" } }
});

try {
  await supabase.auth.getUser();
} catch(e) {
  console.log(e.name, e.message);
}

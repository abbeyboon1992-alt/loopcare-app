import { supabase } from "@/lib/supabase";

export async function createUserWithOrg({
  email,
  password,
  fullName,
  organisationName,
}: {
  email: string;
  password: string;
  fullName: string;
  organisationName: string;
}) {
  // 🔐 SIGN UP USER
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Signup failed");
  }

  const userId = authData.user.id;

  // 🏢 CREATE ORGANISATION
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .insert({
      name: organisationName,
      subscription_status: "free",
    })
    .select()
    .single();

  if (orgError || !org) {
    throw new Error("Failed to create organisation");
  }

  // 👤 CREATE USER PROFILE
  const { error: profileError } = await supabase
    .from("user_profiles")
    .insert({
      id: userId,
      full_name: fullName,
      email,
      organisation_id: org.id,
      role: "owner",
      is_active: true,
    });

  if (profileError) {
    throw new Error("Failed to create user profile");
  }

  return { user: authData.user, organisation: org };
}
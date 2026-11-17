/** Use Supabase's existing mail delivery and rate limits; never disclose account existence. */
export async function requestAccountEmail(auth, email, mode, origin) {
  const redirectTo = new URL("/recover-account", origin).href;
  const address = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(address)) throw new Error("Indiquez une adresse e-mail valide.");
  const result =
    mode === "confirmation"
      ? await auth.resend({
          type: "signup",
          email: address,
          options: { emailRedirectTo: new URL("/login", origin).href },
        })
      : await auth.resetPasswordForEmail(address, { redirectTo });
  if (result.error)
    throw new Error("L’envoi est momentanément indisponible. Patientez puis réessayez.");
}

export function validateNewPassword(password, confirmation) {
  if (password.length < 8) return "Utilisez au moins 8 caractères.";
  if (password !== confirmation) return "Les deux mots de passe doivent être identiques.";
  return "";
}

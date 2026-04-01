export function validateStrongPassword(password) {
  const minLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const valid =
    minLength && hasLower && hasUpper && hasNumber && hasSpecial;

  return {
    valid,
    message:
      "Password must be at least 8 chars and include upper, lower, number, special character.",
  };
}

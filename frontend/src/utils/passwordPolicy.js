export function validateStrongPassword(password) {
  const minLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  return (
    minLength && hasLower && hasUpper && hasNumber && hasSpecial
  );
}

export const PASSWORD_HINT =
  "Password >= 8 ky tu, co chu hoa, chu thuong, so va ky tu dac biet.";

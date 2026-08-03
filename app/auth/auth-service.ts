'use server';

export async function checkUsername(username: string) {
  if (username.length > 6) {
    return { usernameError: 'Username cant be over 6 characters long' };
  } else if (username.length < 3) {
    return { usernameError: 'Username must be at least 3 characters long' };
  }
  return { usernameSuccess: true };
}

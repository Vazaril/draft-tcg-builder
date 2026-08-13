'use server';

import { UserAttributes } from '@supabase/supabase-js';

export async function checkUsername(username: string) {
  if (username.length > 6) {
    return { usernameError: 'Username cant be over 6 characters long' };
  } else if (username.length < 3) {
    return { usernameError: 'Username must be at least 3 characters long' };
  }
  return { usernameSuccess: true };
}

export async function checkUpdateUser(
  currentUsername: string,
  currentEmail: string,
  newUsername: string,
  newEmail: string
) {
  const userAttributes: UserAttributes = { email: '', data: { username: '' } };

  if (currentUsername === newUsername) {
    return { checkError: { message: 'Username needs to be different' } };
  }
  if (currentEmail === newEmail) {
    return { checkError: { message: 'Email needs to be different' } };
  }
  if (newUsername.length > 0) {
    userAttributes.data = { username: newUsername };
  }
  if (newEmail.length > 0) {
    userAttributes.email = newEmail;
  }

  return { userAttributes: userAttributes };
}

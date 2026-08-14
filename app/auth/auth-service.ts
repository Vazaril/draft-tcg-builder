'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export async function checkUsername(username: string) {
  if (username.trim().length > 6) {
    return { usernameError: 'Username cant be over 6 characters long.' };
  } else if (username.trim().length < 3) {
    return { usernameError: 'Username must be at least 3 characters long.' };
  }
  return { usernameSuccess: true };
}

export async function checkUpdateUser(
  currentUsername: string,
  currentEmail: string,
  newUsername: string,
  newEmail: string
) {
  const userAttributes: { email?: string; data?: { username: string } } = {};

  let hasChanges = false;

  if (newUsername.trim().length > 0) {
    if (newUsername.trim() === currentUsername) {
      return { checkError: new Error('Username must be different from your current one.') };
    }
    userAttributes.data = { username: newUsername.trim() };
    hasChanges = true;
  }

  if (newEmail.trim().length > 0) {
    if (newEmail.trim() === currentEmail) {
      return { checkError: new Error('Email must be different from your current one.') };
    }
    userAttributes.email = newEmail.trim();
    hasChanges = true;
  }

  if (!hasChanges) {
    return { checkError: new Error('Please enter a new username or email to update.') };
  }

  return { userAttributes };
}

export async function deleteCurrentUserAccount() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: new Error('You must be logged in to delete your account.') };
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return { error: new Error('Failed to delete account') };
  }

  revalidatePath('/');

  return { success: true };
}

export async function verifyAndUpdatePassword(currentPassword: string, newPassword: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    return { error: new Error('You must be logged in to change your password.') };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: new Error('The current password you entered is incorrect.') };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}

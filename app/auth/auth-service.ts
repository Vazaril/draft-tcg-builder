"use server";

export async function checkUsername (username: string) {
    if (username.length > 6) {
        return {username_error: 'Username cant be over 6 characters long'};
    } else if (username.length < 3) {
        return {username_error:'Username must be at least 3 characters long'};
    }
    return {username_success: true}
}
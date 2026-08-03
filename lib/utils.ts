import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { redirect } from "next/navigation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function encodedRedirect(
    type: "error" | "success" | "search" | "assessment",
    path: string,
    message: string,
) {
  return redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}


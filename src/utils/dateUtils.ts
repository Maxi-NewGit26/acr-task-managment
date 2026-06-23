/**
 * Utility functions for timezone-safe date/time handling.
 * All formatting uses the local browser timezone (Asia/Bangkok for Thai users).
 */

/**
 * Returns YYYY-MM-DD format of a Date in the user's local timezone.
 */
export const getLocalYYYYMMDD = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns HH:MM format of a Date in the user's local timezone.
 */
export const getLocalHHMM = (date: Date = new Date()): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Returns YYYY-MM-DDTHH:MM format of a Date in the user's local timezone.
 */
export const getLocalYYYYMMDDTHHMM = (date: Date = new Date()): string => {
  return `${getLocalYYYYMMDD(date)}T${getLocalHHMM(date)}`;
};

/**
 * Returns YYYY-MM-DD HH:MM:SS format of a Date in the user's local timezone.
 */
export const getLocalTimestamp = (date: Date = new Date()): string => {
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${getLocalYYYYMMDD(date)} ${getLocalHHMM(date)}:${seconds}`;
};

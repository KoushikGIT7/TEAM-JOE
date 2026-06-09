export const validatePhoneNumber = (phone: string): boolean => {
  // Check if it's a valid 10-digit Indian number
  // Removes non-digit characters to check length
  const digits = phone.replace(/\D/g, '');
  
  // Basic validation: must be 10 digits (or 12 if including 91 without +)
  // We'll assume the input should just be the 10 digits, or standard format
  if (digits.length === 10) {
    // Should start with 6, 7, 8, or 9 for Indian mobile numbers
    return /^[6-9]\d{9}$/.test(digits);
  }
  
  if (digits.length === 12 && digits.startsWith('91')) {
    const mobilePart = digits.slice(2);
    return /^[6-9]\d{9}$/.test(mobilePart);
  }

  return false;
};

export const formatPhoneNumber = (phone: string): string => {
  // Always format as +91 followed by 10 digits for Firebase
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return phone; // Return original if we can't reliably format
};

export const validateName = (name: string): boolean => {
  if (!name || name.trim().length < 2 || name.trim().length > 50) {
    return false;
  }
  return true;
};

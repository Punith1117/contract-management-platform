/**
 * File validation utilities for uploads
 */
export const validateResumeFile = (file) => {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isPptx =
    file.type ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    file.name.toLowerCase().endsWith(".pptx");
  if (!isPdf && !isPptx) {
    return { valid: false, reason: "Only PDF and PPTX files supported" };
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE) {
    return { valid: false, reason: "File exceeds max size of 10 MB" };
  }

  return { valid: true };
};

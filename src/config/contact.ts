/**
 * Contact channels. The default number is a TEST placeholder (the 00 operator code does not exist in Ukraine),
 * so nothing reaches a real person until NEXT_PUBLIC_CONTACT_PHONE is set.
 */
export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "+380000000000";
export const CONTACT_IS_TEST = !process.env.NEXT_PUBLIC_CONTACT_PHONE;

const digits = CONTACT_PHONE.replace(/\D/g, "");

export const contactLinks = {
  tel: `tel:+${digits}`,
  whatsapp: `https://wa.me/${digits}`,
  viber: `viber://chat?number=%2B${digits}`,
};

/** +380 00 000 00 00 */
export const formatPhone = (p = CONTACT_PHONE) => {
  const d = p.replace(/\D/g, "");
  return d.length === 12 ? `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : p;
};
